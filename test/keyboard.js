import test from 'tape';

import Motherboard from '../src/motherboard';
import RAM from '../src/ram';
import MMU from '../src/mmu';
import CPU from '../src/cpu';

import Keyboard from '../src/keyboard';

function makeKeyboard() {
  const m = new Motherboard();
  m.addDevice(new MMU(new RAM(256)));
  const c = new CPU(m);
  m.addDevice(c);
  const k = new Keyboard();
  m.addDevice(s);
  return [m, c, k];
}


test('Keyboard: sanity', t => {
  t.doesNotThrow(() => new Keyboard(), null, "keyboard created");
  t.doesNotThrow(() => makeKeyboard(), null, "keyboard created and added to motherboard");
  t.end();
});


test('Keyboard: invalid event', t => {
  const k = new Keyboard();
  t.throws(() => k.addEvent('event'), null, 'invalid event causes error');
  t.throws(() => k.addEvent({ event:'aaa' }), null, 'invalid event causes error');
  t.throws(() => k.addEvent({ event: 'press', shift: false, control: false, alt: true, key: 0xF0000000 }), null, 'invalid key rejected');
  t.end();
});


test('Keyboard: keypresses (poll)', t => {
  const [m, c, k] = makeKeyboard();

  k.addEvent({ event: 'press', shift: false, control: false, alt: true, key: 0x20 });
  k.addEvent({ event: 'release', shift: false, control: false, alt: true, key: 0x20 });

  t.equals(m.get(k.KBD_QUEUE_FULL), 0, 'queue is not full');
  t.equals(m.get(k.KBD_DEQUEUE), (1 << 0x1C) | 0x20, 'dequeued event #1');
  t.equals(m.get(k.KBD_DEQUEUE), (1 << 0x1F) | (1 << 0x1C) | 0x20, 'dequeued event #2');
  t.equals(m.get(k.KBD_DEQUEUE), 0, 'queue empty');

  t.end();
});


test('Keyboard: keypresses (interrupt)', t => {
  const [m, c, k] = makeKeyboard();

  // prepare
  mb.set(0x0, 0x86);  // nop
  mb.set(stg.KBD_MODE, stg.KBD_MODE_INTERRUPT);
  mb.set32(cpu.CPU_INTERRUPT_VECT + (4 * mb.get(stg.KBD_INTERRUPT)), 0x1000);
  cpu.T = true;

  k.addEvent({ event: 'press', shift: false, control: false, alt: true, key: 0x20 });
  mb.step();

  t.equals(cpu.PC, 0x1000, 'interrupt was called');
  t.equals(m.get(k.KBD_QUEUE_FULL), 0, 'queue is not full');
  t.equals(m.get(k.KBD_DEQUEUE), (1 << 0x1C) | 0x20, 'dequeued event #1');

  t.end();
});


test('Keyboard: queue full', t => {
  const [m, c, k] = makeKeyboard();
  
  for(let i=0; i < Keyboard.QUEUE_SIZE; ++i) {
    k.addEvent({ event: 'press', shift: false, control: false, alt: true, key: 0x20 });
  }

  t.equals(m.get(k.KBD_QUEUE_FULL), 1, 'queue is full');

  t.end();
});


// vim: ts=2:sw=2:sts=2:expandtab