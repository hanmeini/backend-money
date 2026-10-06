interface Session {
  deviceId: string;
  deviceToken: string;
}

let session: Session = { deviceId: '', deviceToken: '' };

export function setSession(next: Session): void {
  session = next;
}

export function getSession(): Session {
  return session;
}
