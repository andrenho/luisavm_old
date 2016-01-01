import test from 'tape';

import Motherboard from '../src/motherboard';
import RAM from '../src/ram';
import MMU from '../src/mmu';
import CPU from '../src/cpu';
import cpuEncode from '../src/cpuencode';

function makeCPU() {
  const m = new Motherboard();
  m.addDevice(new MMU(new RAM(256)));
  const c = new CPU(m);
  m.addDevice(c);
  return [m, c];
}


test('CPU: Sanity check', t => {
  let m, c;
  t.doesNotThrow(() => [m, c] = makeCPU(), null, 'CPU is created without errors');
  c.A = 24;
  c.FL = 0b10;
  t.equals(c.A, 24, 'register setter/getter');
  t.ok(c.V, 'flag bits set correctly');
  t.equals(c.PC, 0, 'CPU init address');
  t.end();
});


test('CPU: Get register contents from memory', t => {
  const [mb, cpu] = makeCPU();
  cpu.K = 0xABCDEF01;
  t.equals(cpu.CPU_K, 0xF0002038, 'CPU_K == 0xF0002038');
  t.equals(mb.get32(cpu.CPU_K), 0xABCDEF01, 'read register from memory');
  mb.set32(cpu.CPU_K, 0x12345678);
  t.equals(cpu.K, 0x12345678, 'set register from memory');
  t.equals(mb.get32(cpu.CPU_K), 0x12345678, 'set and then read register from memory');
  t.end();
});


test('CPU: Execute valid basic commands', t => {
  let [mb, cpu] = makeCPU();

  function opc(s, pre) {
    mb.reset();
    if(pre) { 
      pre(); 
    }
    mb.setArray(0, cpuEncode(s));
    let r = `[0x${mb.get(0) < 0x10 ? '0' : ''}${mb.get(0).toString(16)}] ` + s;
    mb.step();
    return r;
  }

  let s;

  // 
  // MOV
  //
  t.comment('Register movement (mov)');

  s = opc('mov A, B', () => cpu.B = 0x42); 
  t.equals(cpu.A, 0x42, s);
  t.equals(cpu.PC, 3, 'checking PC position');

  s = opc('mov A, 0x34'); 
  t.equals(cpu.A, 0x34, s);
  
  s = opc('mov A, 0x1234'); 
  t.equals(cpu.A, 0x1234, s);
  
  s = opc('mov A, 0xFABC1234'); 
  t.equals(cpu.A, 0xFABC1234, s);

  t.comment('Test movement flags');
  
  s = opc('mov A, 0');
  t.true(cpu.Z, 'cpu.Z = 1');
  t.true(cpu.P, 'cpu.P = 1');
  t.false(cpu.S, 'cpu.S = 0');

  s = opc('mov A, 0xF0000001');
  t.false(cpu.Z, 'cpu.Z = 0');
  t.false(cpu.P, 'cpu.P = 0');
  t.true(cpu.S, 'cpu.S = 1');

  // 
  // MOVB
  //
  
  t.comment('8-bit movement (movb)');

  s = opc('movb A, [B]', () => { cpu.B = 0x1000; mb.set(cpu.B, 0xAB); }); 
  t.equals(cpu.A, 0xAB, s);
  
  s = opc('movb A, [0x1000]', () => mb.set(0x1000, 0xAB));
  t.equals(cpu.A, 0xAB, s);

  s = opc('movb [A], A', () => cpu.A = 0x64);
  t.equals(mb.get(0x64), 0x64, s);

  s = opc('movb [A], 0xFA', () => cpu.A = 0x64);
  t.equals(mb.get(0x64), 0xFA, s);

  s = opc('movb [A], [B]', () => { cpu.A = 0x32; cpu.B = 0x64; mb.set(0x64, 0xFF); });
  t.equals(mb.get(0x32), 0xFF, s);

  s = opc('movb [A], [0x6420]', () => { cpu.A = 0x32; mb.set(0x6420, 0xFF); });
  t.equals(mb.get(0x32), 0xFF, s);

  s = opc('movb [0x64], A', () => { cpu.A = 0xAC32; mb.set32(0x64, 0xFF); });
  t.equals(mb.get(0xFF), 0x32, s);

  s = opc('movb [0x64], 0xF0', () => { mb.set32(0x64, 0xFF); });
  t.equals(mb.get(0xFF), 0xF0, s);
  
  s = opc('movb [0xCC64], [A]', () => { 
    cpu.A = 0xF000; mb.set(0xF000, 0x42); 
    mb.set32(0xCC64, 0xFFAB); 
  });
  t.equals(mb.get(0xFFAB), 0x42, s);
  
  s = opc('movb [0x64], [0xABF0]', () => { 
    mb.set32(0x64, 0xFF00);
    mb.set32(0xABF0, 0x1234); mb.set(0x1234, 0x3F);
  });
  t.equals(mb.get(0xFF00), 0x3F, s);

  // 
  // MOVW
  //
  
  t.comment('16-bit movement (movw)');
  
  s = opc('movw A, [B]', () => { cpu.B = 0x1000; mb.set16(cpu.B, 0xABCD); }); 
  t.equals(cpu.A, 0xABCD, s);
  
  s = opc('movw A, [0x1000]', () => mb.set16(0x1000, 0xABCD));
  t.equals(cpu.A, 0xABCD, s);

  s = opc('movw [A], A', () => cpu.A = 0x6402);
  t.equals(mb.get16(0x6402), 0x6402, s);

  s = opc('movw [A], 0xFABA', () => cpu.A = 0x64);
  t.equals(mb.get16(0x64), 0xFABA, s);

  s = opc('movw [A], [B]', () => { cpu.A = 0x32CC; cpu.B = 0x64; mb.set16(0x64, 0xFFAB); });
  t.equals(mb.get16(0x32CC), 0xFFAB, s);

  s = opc('movw [A], [0x6420]', () => { cpu.A = 0x32; mb.set16(0x6420, 0xFFAC); });
  t.equals(mb.get16(0x32), 0xFFAC, s);

  s = opc('movw [0x64], A', () => { cpu.A = 0xAB32AC; mb.set32(0x64, 0xFF); });
  t.equals(mb.get16(0xFF), 0x32AC, s);

  s = opc('movw [0x64], 0xF0FA', () => { mb.set32(0x64, 0xFF); });
  t.equals(mb.get16(0xFF), 0xF0FA, s);
  
  s = opc('movw [0xCC64], [A]', () => { 
    cpu.A = 0xF000; mb.set16(0xF000, 0x4245); 
    mb.set32(0xCC64, 0xFFAB); 
  });
  t.equals(mb.get16(0xFFAB), 0x4245, s);
  
  s = opc('movw [0x64], [0xABF0]', () => { 
    mb.set32(0x64, 0xFF00);
    mb.set32(0xABF0, 0x1234); mb.set16(0x1234, 0x3F54);
  });
  t.equals(mb.get16(0xFF00), 0x3F54, s);

  // 
  // MOVD
  //

  t.comment('32-bit movement (movd)');
  
  s = opc('movd A, [B]', () => { cpu.B = 0x1000; mb.set32(cpu.B, 0xABCDEF01); }); 
  t.equals(cpu.A, 0xABCDEF01, s);
  
  s = opc('movd A, [0x1000]', () => mb.set32(0x1000, 0xABCDEF01));
  t.equals(cpu.A, 0xABCDEF01, s);

  s = opc('movd [A], A', () => cpu.A = 0x16402);
  t.equals(mb.get32(0x16402), 0x16402, s);

  s = opc('movd [A], 0xFABA1122', () => cpu.A = 0x64);
  t.equals(mb.get32(0x64), 0xFABA1122, s);

  s = opc('movd [A], [B]', () => { cpu.A = 0x32CC; cpu.B = 0x64; mb.set32(0x64, 0xFFAB5678); });
  t.equals(mb.get32(0x32CC), 0xFFAB5678, s);

  s = opc('movd [A], [0x6420]', () => { cpu.A = 0x32; mb.set32(0x6420, 0xFFAC9876); });
  t.equals(mb.get32(0x32), 0xFFAC9876, s);

  s = opc('movd [0x64], A', () => { cpu.A = 0xAB32AC44; mb.set32(0x64, 0xFFAC); });
  t.equals(mb.get32(0xFFAC), 0xAB32AC44, s);

  s = opc('movd [0x64], 0xF0FA1234', () => { mb.set32(0x64, 0xFF); });
  t.equals(mb.get32(0xFF), 0xF0FA1234, s);
  
  s = opc('movd [0xCC64], [A]', () => { 
    cpu.A = 0xF000; mb.set32(0xF000, 0x4245AABB); 
    mb.set32(0xCC64, 0xFFAB); 
  });
  t.equals(mb.get32(0xFFAB), 0x4245AABB, s);
  
  s = opc('movd [0x64], [0xABF0]', () => { 
    mb.set32(0x64, 0xFF00);
    mb.set32(0xABF0, 0x1234); mb.set32(0x1234, 0x3F54FABC);
  });
  t.equals(mb.get32(0xFF00), 0x3F54FABC, s);

  //
  // LOGIC OPERATIONS
  //

  t.comment('Logic operations');

  s = opc('or A, B', () => { cpu.A = 0b1010; cpu.B = 0b1100; });
  t.equals(cpu.A, 0b1110, s);
  t.false(cpu.S, "cpu.S == 0");
  t.true(cpu.P, "cpu.P == 1");
  t.false(cpu.Z, "cpu.Z == 0");
  t.false(cpu.Y, "cpu.Y == 0");
  t.false(cpu.V, "cpu.V == 0");

  s = opc('or A, 0x4', () => { cpu.A = 0b11; });
  t.equals(cpu.A, 0b111, s);

  s = opc('or A, 0x4000', () => { cpu.A = 0b111; });
  t.equals(cpu.A, 0x4007, s);

  s = opc('or A, 0x2A426653', () => { cpu.A = 0x10800000; });
  t.equals(cpu.A, 0x3AC26653, s);

  s = opc('xor A, B', () => { cpu.A = 0b1010; cpu.B = 0b1100; });
  t.equals(cpu.A, 0b110, s);

  s = opc('xor A, 0x4', () => { cpu.A = 0b11; });
  t.equals(cpu.A, 0b111, s);

  s = opc('xor A, 0xFF00', () => { cpu.A = 0xFF0; });
  t.equals(cpu.A, 0xF0F0, s);

  s = opc('xor A, 0x2A426653', () => { cpu.A = 0x148ABD12; });
  t.equals(cpu.A, 0x3EC8DB41, s);

  s = opc('and A, B', () => { cpu.A = 0b11; cpu.B = 0b1100; });
  t.equals(cpu.A, 0, s);
  t.true(cpu.Z, "cpu.Z == 1");

  s = opc('and A, 0x7', () => { cpu.A = 0b11; });
  t.equals(cpu.A, 0b11, s);

  s = opc('and A, 0xFF00', () => { cpu.A = 0xFF0; });
  t.equals(cpu.A, 0xF00, s);

  s = opc('and A, 0x2A426653', () => { cpu.A = 0x148ABD12; });
  t.equals(cpu.A, 0x22412, s);

  s = opc('shl A, B', () => { cpu.A = 0b10101010; cpu.B = 4; });
  t.equals(cpu.A, 0b101010100000, s);

  s = opc('shl A, 4', () => { cpu.A = 0b10101010;});
  t.equals(cpu.A, 0b101010100000, s);

  s = opc('shr A, B', () => { cpu.A = 0b10101010; cpu.B = 4; });
  t.equals(cpu.A, 0b1010, s);

  s = opc('shr A, 4', () => { cpu.A = 0b10101010; });
  t.equals(cpu.A, 0b1010, s);

  s = opc('not A', () => { cpu.A = 0b11001010; });
  t.equals(cpu.A, 0b11111111111111111111111100110101, s);

  //
  // integer math
  //

  t.comment('Integer arithmetic');
  
  s = opc('add A, B', () => { cpu.A = 0x12; cpu.B = 0x20; });
  t.equals(cpu.A, 0x32, s);
  
  s = opc('add A, 0x20', () => cpu.A = 0x12);
  t.equals(cpu.A, 0x32, s);

  s = opc('add A, 0x2000', () => cpu.A = 0x12);
  t.equals(cpu.A, 0x2012, s);

  s = opc('add A, 0xF0000000', () => cpu.A = 0x10000012);
  t.equals(cpu.A, 0x12, s);
  t.true(cpu.Y, "cpu.Y == 1");

  s = opc('sub A, B', () => { cpu.A = 0x30; cpu.B = 0x20; });
  t.equals(cpu.A, 0x10, s);
  t.false(cpu.S, 'cpu.S == 0');

  s = opc('sub A, B', () => { cpu.A = 0x20; cpu.B = 0x30; });
  t.equals(cpu.A, 0xFFFFFFF0, 'sub A, B (negative)');
  t.true(cpu.S, 'cpu.S == 1');

  s = opc('sub A, 0x20', () => cpu.A = 0x22);
  t.equals(cpu.A, 0x2, s);

  s = opc('sub A, 0x2000', () => cpu.A = 0x12);
  t.equals(cpu.A, 0xFFFFE012, s);
  t.true(cpu.S, 'cpu.S == 1');
  t.false(cpu.Y, 'cpu.Y == 0');

  s = opc('sub A, 0xF0000000', () => cpu.A = 0x10000012);
  t.equals(cpu.A, 0x20000012, s);
  t.true(cpu.Y, 'cpu.Y == 1');

  s = opc('cmp A, B');
  t.true(cpu.Z, s);

  s = opc('cmp A, 0x12');
  t.true(cpu.LT && !cpu.GT, s);

  s = opc('cmp A, 0x1234', () => cpu.A = 0x6000);
  t.true(!cpu.LT && cpu.GT, s);

  s = opc('cmp A, 0x12345678', () => cpu.A = 0xF0000000);
  t.true(!cpu.LT && cpu.GT, s);  // because of the signal!

  s = opc('mul A, B', () => { cpu.A = 0xF0; cpu.B = 0xF000; });
  t.equals(cpu.A, 0xE10000, s);

  s = opc('mul A, 0x12', () => cpu.A = 0x1234);
  t.equals(cpu.A, 0x147A8, s);

  s = opc('mul A, 0x12AF', () => cpu.A = 0x1234);
  t.equals(cpu.A, 0x154198C, s);
  t.false(cpu.Y, 'cpu.Y == 0');

  s = opc('mul A, 0x12AF87AB', () => cpu.A = 0x1234);
  t.equals(cpu.A, 0x233194BC, s);
  t.true(cpu.Y, 'cpu.Y == 1');

  s = opc('idiv A, B', () => { cpu.A = 0xF000; cpu.B = 0xF0; });
  t.equals(cpu.A, 0x100, s);

  s = opc('idiv A, 0x12', () => cpu.A = 0x1234);
  t.equals(cpu.A, 0x102, s);

  s = opc('idiv A, 0x2AF', () => cpu.A = 0x1234);
  t.equals(cpu.A, 0x6, s);

  s = opc('idiv A, 0x12AF', () => cpu.A = 0x123487AB);
  t.equals(cpu.A, 0xF971, s);

  s = opc('mod A, B', () => { cpu.A = 0xF000; cpu.B = 0xF0; });
  t.equals(cpu.A, 0x0, s);
  t.true(cpu.Z, 'cpu.Z == 1');

  s = opc('mod A, 0x12', () => cpu.A = 0x1234);
  t.equals(cpu.A, 0x10, s);

  s = opc('mod A, 0x2AF', () => cpu.A = 0x1234);
  t.equals(cpu.A, 0x21A, s);

  s = opc('mod A, 0x12AF', () => cpu.A = 0x123487AB);
  t.equals(cpu.A, 0x116C, s);

  s = opc('inc A', () => cpu.A = 0x42);
  t.equals(cpu.A, 0x43, s);

  s = opc('inc A', () => cpu.A = 0xFFFFFFFF);
  t.equals(cpu.A, 0x0, 'inc A (overflow)');
  t.true(cpu.Y, 'cpu.Y == 1');
  t.true(cpu.Z, 'cpu.Z == 1');

  s = opc('dec A', () => cpu.A = 0x42);
  t.equals(cpu.A, 0x41, s);

  s = opc('dec A', () => cpu.A = 0x0);
  t.equals(cpu.A, 0xFFFFFFFF, 'dec A (underflow)');
  t.false(cpu.Z, 'cpu.Z == 0');

  t.end();
});


// vim: ts=2:sw=2:sts=2:expandtab
