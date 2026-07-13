export function mockCheckpointDiscussion(prompt: string): string {
  const checkpoint = prompt.match(/Checkpoint: (.+)/)?.[1] ?? '当前方案';
  const latestMessage = [...prompt.matchAll(/^user: (.+)$/gm)].at(-1)?.[1] ?? '';
  const reply = checkpointReply(latestMessage);
  return `关于${checkpoint}，${reply}我会把这个取舍带进后续规划。还有哪一点让你不踏实，可以接着聊；都顺眼了再确认往下走。`;
}

function checkpointReply(message: string): string {
  if (/预算|成本|花费/.test(message)) {
    return '预算优先级已经记下：首版会先复用现成能力，把昂贵或持续付费的集成放到验证之后。';
  }
  if (/不要|以后|暂不|砍掉/.test(message)) {
    return '这项已经移出首版，不会偷偷换个名字又塞回来；文档里会同时写清延期条件。';
  }
  if (/微信|小程序|手机|移动/.test(message)) {
    return '平台偏好很明确：会保留移动端使用路径，但先判断它是否值得牺牲上线速度。';
  }
  if (/真实|准确|数据|过期/.test(message)) {
    return '“结果必须可信”会升为首版底线，方案里会补数据更新时间、失败兜底和用户反馈闭环。';
  }
  if (/必须|保留|核心/.test(message)) {
    return '这项会留在 P0，并配一条可验证的验收标准，避免“做了”却不知道有没有用。';
  }
  return message
    ? `你的补充“${message.slice(0, 36)}${message.length > 36 ? '...' : ''}”已经记下，并会转成明确的范围或验收条件。`
    : '这一步的结论已经记下。';
}
