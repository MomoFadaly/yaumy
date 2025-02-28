import { batch, signal } from '@preact/signals-core';

export enum Flag {
  None = 0b0,
  Surface = 0b1,
  Block = 0b10,
  Text = 0b100,
  Native = 0b1000,
  // Hovering something, e.g. inline links
  Hovering = 0b10000,
  // Dragging something or opening modal, e.g. drag handle, drag resources from outside, bookmark rename modal
  Hiding = 0b100000,
}

export class Flags {
  value$ = signal(Flag.None);

  get value() {
    return this.value$.peek();
  }

  toggle(flag: Flag, activated: boolean) {
    if (activated) {
      this.value$.value |= flag;
      return;
    }
    this.value$.value &= ~flag;
  }

  check(flag: Flag, value = this.value) {
    return (flag & value) === flag;
  }

  contains(flag: number, value = this.value) {
    return (flag & value) !== Flag.None;
  }

  refresh(flag: Flag) {
    batch(() => {
      this.toggle(flag, false);
      this.toggle(flag, true);
    });
  }

  reset() {
    this.value$.value = Flag.None;
  }

  hide() {
    this.toggle(Flag.Hiding, true);
  }

  show() {
    this.toggle(Flag.Hiding, false);
  }

  isSurface() {
    return this.check(Flag.Surface);
  }

  isText() {
    return this.check(Flag.Text);
  }

  isBlock() {
    return this.check(Flag.Block);
  }

  isNative() {
    return this.check(Flag.Native);
  }
}
