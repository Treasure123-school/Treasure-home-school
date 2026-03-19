declare module 'express-session' {
  import { RequestHandler } from 'express';
  
  interface SessionOptions {
    secret: string | string[];
    name?: string;
    store?: any;
    cookie?: {
      maxAge?: number;
      signed?: boolean;
      expires?: Date;
      httpOnly?: boolean;
      path?: string;
      domain?: string;
      secure?: boolean | 'auto';
      sameSite?: boolean | 'lax' | 'strict' | 'none';
    };
    genid?: (req: any) => string;
    rolling?: boolean;
    resave?: boolean;
    proxy?: boolean;
    saveUninitialized?: boolean;
    unset?: 'destroy' | 'keep';
  }

  interface Session {
    id: string;
    cookie: any;
    regenerate(callback: (err: any) => void): void;
    destroy(callback: (err: any) => void): void;
    reload(callback: (err: any) => void): void;
    save(callback: (err: any) => void): void;
    touch(): void;
    [key: string]: any;
  }

  interface SessionData {
    cookie: any;
    [key: string]: any;
  }

  function session(options: SessionOptions): RequestHandler;
  
  export = session;
}

declare module 'connect-sqlite3' {
  function ConnectSqlite3(session: any): any;
  export = ConnectSqlite3;
}
