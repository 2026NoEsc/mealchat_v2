import type { Route } from './routes';

/**
 * 스택에서 한 장을 걷어내고, 돌아가는 화면에 넘겨줄 값을 params 에 병합한다.
 *
 * 네비게이터는 최상단 한 장만 렌더하므로 뒤로 가면 앞 화면이 새로 마운트된다.
 * 그냥 걷어내기만 하면 사용자가 STEP 1 에 적어 둔 약속 이름·장소가 전부 사라진다.
 * 그래서 뒤 화면이 들고 있던 값을 params 로 실어 보내 다시 채울 수 있게 한다.
 *
 * 병합이라 넘기지 않은 키는 남는다. params 가 없으면 걷어내기만 한다.
 */
export function popStack(stack: Route[], params?: Record<string, unknown>): Route[] {
  if (stack.length <= 1) {
    return stack;
  }

  const next = stack.slice(0, -1);
  if (!params) {
    return next;
  }

  const target = next[next.length - 1];
  next[next.length - 1] = { ...target, params: { ...target.params, ...params } };
  return next;
}
