import { isObject } from '@hominem/utils';

function toResponseInit(init: object | undefined): ResponseInit {
  if (!init) return {};
  const status = Reflect.get(init, 'status');
  const statusText = Reflect.get(init, 'statusText');
  const headers = Reflect.get(init, 'headers');
  return {
    ...(typeof status === 'number' ? { status } : {}),
    ...(typeof statusText === 'string' ? { statusText } : {}),
    ...(headers instanceof Headers ? { headers } : {}),
    ...(isObject(headers) && !(headers instanceof Headers)
      ? { headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, String(v)])) }
      : {}),
  };
}

/** Turns what a React Router action returns (a Response or `data(...)`) into a Response. */
export function toRouteResponse(result: unknown): Response {
  if (result instanceof Response) {
    return result;
  }

  if (
    isObject(result) &&
    'type' in result &&
    result.type === 'DataWithResponseInit' &&
    'data' in result
  ) {
    return Response.json(
      result.data,
      toResponseInit('init' in result && isObject(result.init) ? result.init : undefined),
    );
  }

  return Response.json(result);
}
