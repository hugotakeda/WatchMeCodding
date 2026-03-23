declare module 'y-websocket/bin/utils' {
  import { IncomingMessage } from 'http';
  import WebSocket from 'ws';

  export function setupWSConnection(
    conn: WebSocket,
    req: IncomingMessage,
    options?: {
      docName?: string;
      gc?: boolean;
    },
  ): void;
}
