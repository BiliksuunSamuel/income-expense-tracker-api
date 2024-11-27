import { ActorSystemRef, start } from 'nact';

export class BaseActor {
  public readonly system: ActorSystemRef = start();
}
