import * as EventTarget from '../../../../../lib/eventtarget';
import { EventEmitter } from 'events';
import * as sinon from 'sinon';
import { inherits } from 'util';

export const WebSocket: any = sinon.spy(function MockWebSocket(url: string) {
  EventTarget.call(this);
  this.close = sinon.spy(() => {
    this.readyState = WebSocket.CLOSED;
    this.dispatchEvent({ type: 'close' });
    this.emit('close');
  });
  this.send = sinon.spy(() => {});
  this.terminate = sinon.spy(() => {});
  this.readyState = WebSocket.CONNECTING;
});

inherits(WebSocket, EventTarget);

WebSocket.CONNECTING = 0;
WebSocket.OPEN = 1;
WebSocket.CLOSING = 2;
WebSocket.CLOSED = 3;

WebSocket.prototype.on = function on(event: string, callback: (...args: any[]) => void): void {
  this.addEventListener(event, function(e) {
    callback.apply(null, e.data);
  });
};

WebSocket.prototype.once = function once(event: string, callback: (...args: any[]) => void): void {
  const self = this;
  this.addEventListener(event, function onevent(e) {
    callback.apply(null, e.data);
    self.removeEventListener(event, onevent);
  });
};

WebSocket.prototype.emit = function emit(event: string, ...args: any[]): void {
  this.dispatchEvent({ type: event, data: args });
};

WebSocket.Server = sinon.spy(function MockWebSocketServer(opts: any) {
  EventEmitter.call(this);
  this.close = sinon.spy(() => {});
});

inherits(WebSocket.Server, EventEmitter);
