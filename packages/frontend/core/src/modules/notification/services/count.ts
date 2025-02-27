import {
  backoffRetry,
  catchErrorInto,
  effect,
  exhaustMapWithTrailing,
  fromPromise,
  LiveData,
  onComplete,
  OnEvent,
  onStart,
  Service,
} from '@toeverything/infra';
import { EMPTY, interval, mergeMap, switchMap, timer } from 'rxjs';

import { isBackendError, isNetworkError } from '../../cloud';
import { ServerStarted } from '../../cloud/events/server-started';
import { ApplicationFocused } from '../../lifecycle';
import type { NotificationStore } from '../stores/notification';

@OnEvent(ApplicationFocused, s => s.handleApplicationFocused)
@OnEvent(ServerStarted, s => s.handleServerStarted)
export class NotificationCountService extends Service {
  constructor(private readonly store: NotificationStore) {
    super();
  }

  readonly count$ = LiveData.from(this.store.watchNotificationCountCache(), 0);
  readonly isLoading$ = new LiveData(false);
  readonly error$ = new LiveData<any>(null);

  revalidate = effect(
    switchMap(() => {
      return timer(0, 30000); // revalidate every 30 seconds
    }),
    exhaustMapWithTrailing(() => {
      return fromPromise(signal =>
        this.store.getNotificationCount(signal)
      ).pipe(
        mergeMap(result => {
          this.setCount(result ?? 0);
          return EMPTY;
        }),
        backoffRetry({
          when: isNetworkError,
          count: Infinity,
        }),
        backoffRetry({
          when: isBackendError,
        }),
        catchErrorInto(this.error$),
        onStart(() => {
          this.isLoading$.setValue(true);
        }),
        onComplete(() => this.isLoading$.setValue(false))
      );
    })
  );

  handleApplicationFocused() {
    this.revalidate();
  }

  handleServerStarted() {
    this.revalidate();
  }

  setCount(count: number) {
    this.store.setNotificationCountCache(count);
  }

  override dispose(): void {
    super.dispose();
    this.revalidate.unsubscribe();
  }
}
