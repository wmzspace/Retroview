import { BadRequestException, Body, Controller, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { AgentService } from './agent.service';

@Controller('api')
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  /** 上传新面经：LLM 分块抽取知识点后写入知识库 */
  @Post('import')
  async importInterview(
    @Body() body: { company: string; round?: string; date?: string; status?: string; text: string },
  ) {
    try {
      return await this.agent.importInterview({
        company: body?.company || '',
        round: body?.round,
        date: body?.date,
        status: body?.status,
        text: body?.text || '',
      });
    } catch (e: any) {
      throw new BadRequestException(e?.message || String(e));
    }
  }

  /** SSE 流式问答：token 事件 + refs 事件 + done/error 事件 */
  @Post('chat')
  async chat(
    @Body() body: { message: string; history?: { role: string; content: string }[] },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (obj: any) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
    const history = (body.history || []).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let sentTokens = false;
    let finalAnswer = '';

    try {
      const stream = await this.agent.streamEvents({
        question: body.message,
        history,
      });
      for await (const ev of stream as AsyncIterable<any>) {
        // token 级流式
        if (ev.event === 'on_chat_model_stream') {
          const token = ev.data?.chunk?.content;
          if (typeof token === 'string' && token) {
            sentTokens = true;
            send({ type: 'token', content: token });
          }
        }
        // 检索完成 → 推送引用
        else if (ev.event === 'on_chain_end' && ev.name === 'retrieve') {
          const refs = ev.data?.output?.refs || [];
          send({
            type: 'refs',
            refs: refs.map((r: any) => ({
              id: r.id, company: r.company, question: r.question,
              quality: r.quality, category: r.category,
            })),
          });
        }
        // generate 完成 → 记录最终答案（本地模式兜底）
        else if (ev.event === 'on_chain_end' && ev.name === 'generate') {
          finalAnswer = ev.data?.output?.answer || '';
        }
      }
      if (!sentTokens && finalAnswer) {
        send({ type: 'token', content: finalAnswer });
      }
      send({ type: 'done' });
    } catch (e: any) {
      send({ type: 'error', message: e?.message || String(e) });
    } finally {
      res.end();
    }
  }
}
