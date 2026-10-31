import { spawn } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const schemaPath = resolve('ai-schema.json');
function findCodex(){
  if(process.env.DAYFLOW_CODEX_PATH && existsSync(process.env.DAYFLOW_CODEX_PATH)) return process.env.DAYFLOW_CODEX_PATH;
  const root=join(process.env.LOCALAPPDATA||'', 'OpenAI','Codex','bin');
  if(existsSync(root)) for(const dir of readdirSync(root).reverse()){const p=join(root,dir,'codex.exe');if(existsSync(p))return p;}
  return process.platform==='win32'?'codex.exe':'codex';
}
export function askCodex(messages,today){return new Promise((resolveResult,reject)=>{
 const prompt=`당신은 한국어 개인 알림장 작성 도우미입니다. 오늘은 ${today}입니다. 아래 대화를 참고하여 친절하고 간결하게 응답하세요. 날짜나 알림 내용이 불명확하면 질문하세요. 사용자가 알림을 추가하려는 의도를 밝혔고 제목과 대상 날짜가 충분히 명확할 때만 notice에 제안하세요. 그 외에는 notice를 null로 설정하세요. 사용자가 말하지 않은 내용을 임의로 만들지 마세요. 알림은 사용자가 별도로 확인해 저장하므로 이미 저장하거나 추가했다고 말하지 말고 검토를 안내하세요. 도구, 파일, 명령을 사용하지 말고 대화 내용만 해석하세요. 응답은 지정된 JSON 형식만 사용하세요.\n대화 데이터: ${JSON.stringify(messages)}`;
 const child=spawn(findCodex(),['exec','--ignore-user-config','--ephemeral','--skip-git-repo-check','--sandbox','read-only','--json','--output-schema',schemaPath,'-'],{cwd:tmpdir(),windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,OPENAI_API_KEY:'',CODEX_API_KEY:''}});
 let out='',stderr='',settled=false;const timer=setTimeout(()=>{child.kill();finish(new Error('AI 응답 시간이 초과되었습니다. 다시 시도해 주세요.'))},120000);
 function finish(error,result){if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolveResult(result)}
 child.on('error',()=>finish(new Error('Codex CLI를 실행할 수 없습니다. 설치와 로그인 상태를 확인해 주세요.')));
 child.stdout.on('data',d=>{out+=d.toString();if(out.length>1000000){child.kill();finish(new Error('AI 응답이 너무 깁니다.'))}});child.stderr.on('data',d=>{stderr=(stderr+d.toString()).slice(-4000)});
 child.on('close',code=>{if(code!==0)return finish(new Error('Codex 응답을 가져오지 못했습니다. 로그인 상태와 네트워크를 확인해 주세요.'));try{let last;for(const line of out.split('\n')){if(!line.trim())continue;const e=JSON.parse(line);if(e.type==='item.completed'&&e.item?.type==='agent_message')last=e.item.text;}const result=JSON.parse(last);if(typeof result.reply!=='string'||!result.reply.trim())throw Error();if(result.notice){const n=result.notice;if(typeof n.title!=='string'||!n.title.trim()||n.title.length>200||typeof n.content!=='string'||n.content.length>10000||typeof n.target_date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(n.target_date)||Number.isNaN(Date.parse(n.target_date+'T00:00:00Z'))||new Date(n.target_date+'T00:00:00Z').toISOString().slice(0,10)!==n.target_date||typeof n.important!=='boolean')throw Error();}finish(null,result)}catch{finish(new Error('AI 응답을 읽을 수 없습니다. 다시 시도해 주세요.'))}});child.stdin.on('error',()=>{});child.stdin.end(prompt);
})}
