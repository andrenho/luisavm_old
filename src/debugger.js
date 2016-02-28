/* Functionalities:
 *   - [?] help
 *     Memory
 *       - [d]ump memory block
 *       - [e]nter memory data
 *       - [f]ill memory with data
 *       - [c]opy memory block
 *       - search for [p]attern
 *     CPU
 *       - [r]egisters
 *       - [s]tep through
 *       - step [o]ver
 *       - [r]un
 *       - [s]et/[u]nset breakpoint
 *     Video
 *       - dump [t]ext
 *     Code
 *       - [a]ssemble
 *       - [d]isassemble
 *     File operations (?)
 *     Other
 *       - [h]ex calculator
 */


function h(n, digits) {
  return (Array(digits || 0).join('0') + n.toString(16)).substr(-digits).toUpperCase();
}


export default class Debugger {

  constructor(tinyvm) {
    this._vm = tinyvm;
    this._const = this._loadConstants();
  }


  parse(s) {
    let [cmd, ...pars] = s.split(' ');
    switch (cmd) {
      case '?': case 'h': return this._help();
      case 'r': return this._registers();
      case 's': return this._step();
      default: return 'syntax error (use [?] for help)';
    }
  }


  welcome() {
    return 'Welcome to TinyVM debugger. Type \'?\' for help.\n\n' + this._currentInstruction();
  }


  _loadConstants() {
    let _const = {};
    for (let dev of this._vm.mb.devices) {
      for (let c in dev.constantList()) {
        _const[dev[c]] = c;
      }
    }
    return _const;
  }


  _help() {
    return `CPU:
  [r] Registers
  [s] step through
  [o] step over
  [c] continue execution
  [s]/[u] set/unset breakpoint ([address=PC])
  [l] disassemly ([address=PC])

Memory:
  [d] dump memory block     (address [size=0x100])
  [e] enter memory data     (address value)
  [f] fill memory with data (address size value)
  [c] copy memory block     (origin destination size)
  [p] search for pattern    (pattern [beginning [end]])
  [v] virtual memory info

Other:
  [t] dump video text`;
  }


  _currentInstruction() {
    return `:: PC 0x${h(this._vm.cpu.PC,8)} -> ${this.decode()[0]}`;
  }


  _registers() {
    const c = this._vm.cpu;
    return `A: ${h(c.A,8)}    E: ${h(c.E,8)}    I: ${h(c.I,8)}    FP: ${h(c.FP,8)}
B: ${h(c.B,8)}    F: ${h(c.F,8)}    J: ${h(c.J,8)}    SP: ${h(c.SP,8)}
C: ${h(c.C,8)}    G: ${h(c.G,8)}    K: ${h(c.K,8)}    PC: ${h(c.PC,8)}
D: ${h(c.D,8)}    H: ${h(c.H,8)}    L: ${h(c.L,8)}    FL: ${h(c.FL,8)}

Flags => Y:${c.Y?1:0}  V:${c.V?1:0}  Z:${c.Z?1:0}  S:${c.S?1:0}  GT:${c.GT?1:0}  LT:${c.LT?1:0}  P:${c.P?1:0}  T:${c.T?1:0}

${this._currentInstruction()}`;
  }


  _step() {
    this._vm.step();
    return this._currentInstruction();
  }


  //
  // INSTRUCTION ENCODING
  //

  static encode(s) {

    function registerValue(r) {
      switch (r) {
        case 'a': return 0;
        case 'b': return 1;
        case 'c': return 2;
        case 'd': return 3;
        case 'e': return 4;
        case 'f': return 5;
        case 'g': return 6;
        case 'h': return 7;
        case 'i': return 8;
        case 'j': return 9;
        case 'k': return 10;
        case 'l': return 11;
        case 'fp': return 12;
        case 'sp': return 13;
        case 'pc': return 14;
        case 'fl': return 15;
        default: throw new Error('Invalid register ' + r);
      }
    }

    //
    // understand command
    //

    // TODO - not working with one single parameter
    const m = s.match(/^\s*([a-z\.]+)(?:\s+(\[?(?:[a-l]|fp|sp|pc|fl|0x[0-9a-f]+|[0-9]+)\]?))?(?:\s*,\s*(\[?(?:[a-l]|fp|sp|pc|fl|0x[0-9a-f]+|[0-9]+)\]?))?\s*$/i); // https://regex101.com/r/pV1pA9/2
    if (!m) {
      throw new Error('Invalid command `' + s + '`');
    } 

    let cmd = { opcode: m[1], pars: [] };
    for (let i = 2; i < m.length; ++i) {
      if (m[i] == undefined) {
        continue;
      }

      let type;
      let value;
      let size;
      let valArray = [];
      if (m[i][0] === '[') {
        if (m[i].slice(-1) !== ']') {
          throw new Error('Unbalanced bracket in ' + m[i]);
        }
        if (m[i][1].charCodeAt(0) > '9'.charCodeAt(0)) {
          type = 'indirect register';
          value = registerValue(m[i].slice(1, -1).toLowerCase());
          size = 8;
          valArray = [value];
        } else {
          type = 'indirect value';
          value = parseInt(m[i].slice(1, -1));  // TODO - doesn't work with binary
          size = 32;
          valArray = [value & 0xFF, (value >> 8) & 0xFF, (value >> 16) & 0xFF, (value >> 24) & 0xFF];
        }
      } else if (m[i].charCodeAt(0) > '9'.charCodeAt(0)) {
        type = 'register';
        value = registerValue(m[i].toLowerCase());
        size = 8;
        valArray = [value];
      } else {
        type = 'value';
        value = parseInt(m[i]);
        if (value <= 0xFF) {
          size = 8;
          valArray = [value];
        } else if (value <= 0xFFFF) {
          size = 16;
          valArray = [value & 0xFF, value >> 8];
        } else {
          size = 32;
          valArray = [value & 0xFF, (value >> 8) & 0xFF, (value >> 16) & 0xFF, (value >> 24) & 0xFF];
        }
      }
      cmd.pars.push({ type, value, size, valArray });
    }

    //
    // parse command (TODO)
    //
    try {
      var [t0, v0, a0, s0] = [cmd.pars[0].type, cmd.pars[0].value, cmd.pars[0].valArray, cmd.pars[0].size];
    } catch (e) {
      if (e instanceof TypeError) {
        var [t0, v0, a0, s0] = ['none', 0, [], 0];
      } else {
        throw e;
      }
    }
    try {
      var [t1, v1, a1, s1] = [cmd.pars[1].type, cmd.pars[1].value, cmd.pars[1].valArray, cmd.pars[1].size];
    } catch (e) {
      if (e instanceof TypeError) {
        var [t1, v1, a1, s1] = ['none', 0, [], 0];
      } else {
        throw e;
      }
    }

    let opcode = null;

    switch (cmd.opcode) {

      case 'mov':
        if (t0 === 'register' && t1 !== 'none') {  // only valid condition
          if (t1 === 'register') {
            opcode = 0x01;
          } else if (t1 === 'value') {
            switch (s1) {
              case 8:  opcode = 0x02; break;
              case 16: opcode = 0x03; break;
              case 32: opcode = 0x04; break;
            }
          }
          if (opcode) {
            return [opcode, v0].concat(a1);
          }
        }
        break;

      case 'movb':
        if (t0 === 'register') {
          switch (t1) {
            case 'indirect register': opcode = 0x05; break;
            case 'indirect value':    opcode = 0x06; break;
          }
        } else if (t0 === 'indirect register') {
          switch (t1) {
            case 'register':          opcode = 0x0B; break;
            case 'value':           
              if (s1 <= 8) { 
                opcode = 0x0C; 
              }
              break;
            case 'indirect register': opcode = 0x0D; break;
            case 'indirect value':    opcode = 0x0E; break;
          }
        } else if (t0 === 'indirect value') {
          switch (t1) {
            case 'register':          opcode = 0x21; break;
            case 'value':           
              if (s1 <= 8) { 
                opcode = 0x22;
              }
              break;
            case 'indirect register': opcode = 0x23; break;
            case 'indirect value':    opcode = 0x24; break;
          }
        }
        if (opcode) {
          return [opcode].concat(a0).concat(a1);
        }
        break;

      case 'movw':
        if (t0 === 'register') {
          switch (t1) {
            case 'indirect register': opcode = 0x07; break;
            case 'indirect value':    opcode = 0x08; break;
          }
        } else if (t0 === 'indirect register') {
          switch (t1) {
            case 'register':          opcode = 0x0F; break;
            case 'value':           
              if (s1 <= 16) { 
                return [0x1A].concat(a0).concat([v1 & 0xFF, v1 >> 8]);
              }
              break;
            case 'indirect register': opcode = 0x1B; break;
            case 'indirect value':    opcode = 0x1C; break;
          }
        } else if (t0 === 'indirect value') {
          switch (t1) {
            case 'register':          opcode = 0x25; break;
            case 'value':
              if (s1 <= 16) { 
                return [0x26].concat(a0).concat([v1 & 0xFF, v1 >> 8]);
              }
              break;
            case 'indirect register': opcode = 0x27; break;
            case 'indirect value':    opcode = 0x28; break;
          }
        }
        if (opcode) {
          return [opcode].concat(a0).concat(a1);
        }
        break;

      case 'movd':
        if (t0 === 'register') {
          switch (t1) {
            case 'indirect register': opcode = 0x09; break;
            case 'indirect value':    opcode = 0x0A; break;
          }
        } else if (t0 === 'indirect register') {
          switch (t1) {
            case 'register':          opcode = 0x1D; break;
            case 'value':           
              return [0x1E].concat(a0).concat([v1 & 0xFF, (v1 >> 8) & 0xFF, (v1 >> 16) & 0xFF, (v1 >> 24) & 0xFF]);
            case 'indirect register': opcode = 0x1F; break;
            case 'indirect value':    opcode = 0x20; break;
          }
        } else if (t0 === 'indirect value') {
          switch (t1) {
            case 'register':          opcode = 0x29; break;
            case 'value':           
              return [0x2A].concat(a0).concat([v1 & 0xFF, (v1 >> 8) & 0xFF, (v1 >> 16) & 0xFF, (v1 >> 24) & 0xFF]);
            case 'indirect register': opcode = 0x2B; break;
            case 'indirect value':    opcode = 0x2C; break;
          }
        }
        if (opcode) {
          return [opcode].concat(a0).concat(a1);
        }
        break;

      case 'or':
        if (t0 === 'register') {
          if (t1 === 'register') {
            return [0x2D].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 8) {
            return [0x2E].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 16) {
            return [0x2F].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 32) {
            return [0x30].concat(a0).concat(a1);
          }
        }
        break;

      case 'xor':
        if (t0 === 'register') {
          if (t1 === 'register') {
            return [0x31].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 8) {
            return [0x32].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 16) {
            return [0x33].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 32) {
            return [0x34].concat(a0).concat(a1);
          }
        }
        break;

      case 'and':
        if (t0 === 'register') {
          if (t1 === 'register') {
            return [0x35].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 8) {
            return [0x36].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 16) {
            return [0x37].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 32) {
            return [0x38].concat(a0).concat(a1);
          }
        }
        break;

      case 'shl':
        if (t0 === 'register') {
          if (t1 === 'register') {
            return [0x39].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 8) {
            return [0x3A].concat(a0).concat(a1);
          }
        }
        break;

      case 'shr':
        if (t0 === 'register') {
          if (t1 === 'register') {
            return [0x3D].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 8) {
            return [0x3E].concat(a0).concat(a1);
          }
        }
        break;

      case 'not':
        if (t0 === 'register' && t1 === 'none') {
          return [0x41].concat(a0);
        }
        break;

      case 'add':
        if (t0 === 'register') {
          if (t1 === 'register') {
            return [0x42].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 8) {
            return [0x43].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 16) {
            return [0x44].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 32) {
            return [0x45].concat(a0).concat(a1);
          }
        }
        break;

      case 'sub':
        if (t0 === 'register') {
          if (t1 === 'register') {
            return [0x46].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 8) {
            return [0x47].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 16) {
            return [0x48].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 32) {
            return [0x49].concat(a0).concat(a1);
          }
        }
        break;

      case 'cmp':
        if (t0 === 'register') {
          if (t1 === 'register') {
            return [0x4A].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 8) {
            return [0x4B].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 16) {
            return [0x4C].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 32) {
            return [0x4D].concat(a0).concat(a1);
          }
        }
        break;

      case 'mul':
        if (t0 === 'register') {
          if (t1 === 'register') {
            return [0x4E].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 8) {
            return [0x4F].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 16) {
            return [0x50].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 32) {
            return [0x51].concat(a0).concat(a1);
          }
        }
        break;

      case 'idiv':
        if (t0 === 'register') {
          if (t1 === 'register') {
            return [0x52].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 8) {
            return [0x53].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 16) {
            return [0x54].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 32) {
            return [0x55].concat(a0).concat(a1);
          }
        }
        break;

      case 'mod':
        if (t0 === 'register') {
          if (t1 === 'register') {
            return [0x56].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 8) {
            return [0x57].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 16) {
            return [0x58].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 32) {
            return [0x59].concat(a0).concat(a1);
          }
        }
        break;

      case 'inc':
        if (t0 === 'register' && t1 === 'none') {
          return [0x5A].concat(a0);
        }
        break;

      case 'dec':
        if (t0 === 'register' && t1 === 'none') {
          return [0x5B].concat(a0);
        }
        break;

      /*
      case 'fadd':
        if (t0 === 'register') {
          if (t1 === 'register') {
            return [0x7F].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 8) {
            return [0x80].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 16) {
            return [0x81].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 32) {
            return [0x82].concat(a0).concat(a1);
          }
        }
        break;

      case 'fsub':
        if (t0 === 'register') {
          if (t1 === 'register') {
            return [0x83].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 8) {
            return [0x84].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 16) {
            return [0x85].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 32) {
            return [0x86].concat(a0).concat(a1);
          }
        }
        break;

      case 'fcmp':
        if (t0 === 'register') {
          if (t1 === 'register') {
            return [0x87].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 8) {
            return [0x88].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 16) {
            return [0x89].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 32) {
            return [0x8A].concat(a0).concat(a1);
          }
        }
        break;

      case 'fmul':
        if (t0 === 'register') {
          if (t1 === 'register') {
            return [0x8B].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 8) {
            return [0x8C].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 16) {
            return [0x8D].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 32) {
            return [0x8E].concat(a0).concat(a1);
          }
        }
        break;

      case 'fdiv':
        if (t0 === 'register') {
          if (t1 === 'register') {
            return [0x8F].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 8) {
            return [0x90].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 16) {
            return [0x91].concat(a0).concat(a1);
          } else if (t1 === 'value' && s1 === 32) {
            return [0x92].concat(a0).concat(a1);
          }
        }
        break;
      */

      case 'bz':
      case 'beq':
        if (t0 === 'register' && t1 === 'none') {
          return [0x5C].concat(a0);
        } else if (t0 === 'value' && t1 === 'none') {
          return [0x5D, v0 & 0xFF, (v0 >> 8) & 0xFF, (v0 >> 16) & 0xFF, (v0 >> 24) & 0xFF];
        }
        break;

      case 'bnz':
      case 'bneq':
        if (t0 === 'register' && t1 === 'none') {
          return [0x5E].concat(a0);
        } else if (t0 === 'value' && t1 === 'none') {
          return [0x5F, v0 & 0xFF, (v0 >> 8) & 0xFF, (v0 >> 16) & 0xFF, (v0 >> 24) & 0xFF];
        }
        break;

      case 'bneg':
        if (t0 === 'register' && t1 === 'none') {
          return [0x60].concat(a0);
        } else if (t0 === 'value' && t1 === 'none') {
          return [0x61, v0 & 0xFF, (v0 >> 8) & 0xFF, (v0 >> 16) & 0xFF, (v0 >> 24) & 0xFF];
        }
        break;

      case 'bpos':
        if (t0 === 'register' && t1 === 'none') {
          return [0x62].concat(a0);
        } else if (t0 === 'value' && t1 === 'none') {
          return [0x63, v0 & 0xFF, (v0 >> 8) & 0xFF, (v0 >> 16) & 0xFF, (v0 >> 24) & 0xFF];
        }
        break;

      case 'bgt':
        if (t0 === 'register' && t1 === 'none') {
          return [0x64].concat(a0);
        } else if (t0 === 'value' && t1 === 'none') {
          return [0x65, v0 & 0xFF, (v0 >> 8) & 0xFF, (v0 >> 16) & 0xFF, (v0 >> 24) & 0xFF];
        }
        break;

      case 'bgte':
        if (t0 === 'register' && t1 === 'none') {
          return [0x66].concat(a0);
        } else if (t0 === 'value' && t1 === 'none') {
          return [0x67, v0 & 0xFF, (v0 >> 8) & 0xFF, (v0 >> 16) & 0xFF, (v0 >> 24) & 0xFF];
        }
        break;

      case 'blt':
        if (t0 === 'register' && t1 === 'none') {
          return [0x68].concat(a0);
        } else if (t0 === 'value' && t1 === 'none') {
          return [0x69, v0 & 0xFF, (v0 >> 8) & 0xFF, (v0 >> 16) & 0xFF, (v0 >> 24) & 0xFF];
        }
        break;

      case 'blte':
        if (t0 === 'register' && t1 === 'none') {
          return [0x6A].concat(a0);
        } else if (t0 === 'value' && t1 === 'none') {
          return [0x6B, v0 & 0xFF, (v0 >> 8) & 0xFF, (v0 >> 16) & 0xFF, (v0 >> 24) & 0xFF];
        }
        break;

      case 'bv':
        if (t0 === 'register' && t1 === 'none') {
          return [0x6C].concat(a0);
        } else if (t0 === 'value' && t1 === 'none') {
          return [0x6D, v0 & 0xFF, (v0 >> 8) & 0xFF, (v0 >> 16) & 0xFF, (v0 >> 24) & 0xFF];
        }
        break;

      case 'bnv':
        if (t0 === 'register' && t1 === 'none') {
          return [0x6E].concat(a0);
        } else if (t0 === 'value' && t1 === 'none') {
          return [0x6F, v0 & 0xFF, (v0 >> 8) & 0xFF, (v0 >> 16) & 0xFF, (v0 >> 24) & 0xFF];
        }
        break;

      case 'jmp':
        if (t0 === 'register' && t1 === 'none') {
          return [0x70].concat(a0);
        } else if (t0 === 'value' && t1 === 'none') {
          return [0x71, v0 & 0xFF, (v0 >> 8) & 0xFF, (v0 >> 16) & 0xFF, (v0 >> 24) & 0xFF];
        }
        break;

      case 'jsr':
        if (t0 === 'register' && t1 === 'none') {
          return [0x72].concat(a0);
        } else if (t0 === 'value' && t1 === 'none') {
          return [0x73, v0 & 0xFF, (v0 >> 8) & 0xFF, (v0 >> 16) & 0xFF, (v0 >> 24) & 0xFF];
        }
        break;

      case 'ret':
        if (t0 === 'none' && t1 === 'none') {
          return [0x74];
        }
        break;

      case 'sys':
        if (t0 === 'register' && t1 === 'none') {
          return [0x75].concat(a0);
        } else if (t0 === 'value' && s0 === 8 && t1 === 'none') {
          return [0x76, v0];
        }
        break;

      case 'iret':
        if (t0 === 'none' && t1 === 'none') {
          return [0x77];
        }
        break;

      case 'sret':
        if (t0 === 'none' && t1 === 'none') {
          return [0x86];
        }
        break;

      case 'pushb':
        if (t0 === 'register' && t1 === 'none') {
          return [0x78].concat(a0);
        } else if (t0 === 'value' && s0 <= 8 && t1 === 'none') {
          return [0x79].concat(a0);
        }
        break;

      case 'pushw':
        if (t0 === 'register' && t1 === 'none') {
          return [0x7A].concat(a0);
        } else if (t0 === value && s0 <= 16 && t1 === 'none') {
          return [0x7B].concat([v0 & 0xFF, v0 >> 8]);
        }
        break;

      case 'pushd':
        if (t0 === 'register' && t1 === 'none') {
          return [0x7C].concat(a0);
        } else if (t0 === 'value' && s0 <= 16 && t1 === 'none') {
          return [0x7D].concat([v0 & 0xFF, (v0 >> 8) & 0xFF, (v0 >> 16) & 0xFF, (v0 >> 24) & 0xFF]);
        }
        break;

      case 'push.a':
        if (t0 === 'none' && t1 === 'none') {
          return [0x7E];
        }
        break;

      case 'popb':
        if (t0 === 'register' && t1 === 'none') {
          return [0x7F].concat(a0);
        }
        break;

      case 'popw':
        if (t0 === 'register' && t1 === 'none') {
          return [0x80].concat(a0);
        }
        break;

      case 'popd':
        if (t0 === 'register' && t1 === 'none') {
          return [0x81].concat(a0);
        }
        break;

      case 'pop.a':
        if (t0 === 'none' && t1 === 'none') {
          return [0x82];
        }
        break;

      case 'popx':
        if (t0 === 'register' && t1 === 'none') {
          return [0x83].concat(a0);
        } else if (t0 === 'value' && s0 <= 8 && t1 === 'none') {
          return [0x84].concat(a0);
        } else if (t0 === 'value' && s0 <= 16 && t1 === 'none') {
          return [0x85].concat(a0);
        }
        break;

      case 'nop':
        if (t0 === 'none' && t1 === 'none') {
          return [0x87];
        }
        break;

    }

    throw new Error(`Invalid command '${s}'`);
  }

  // 
  // DECODING
  //
  decode(addr) {

    if (addr === undefined) 
      addr = this._vm.cpu.PC;

    function h(n, digits) {
      return (Array(digits || 0).join('0') + n.toString(16)).substr(-digits).toUpperCase();
    }

    function reg(n) {
      switch (n) {
        case 0x0: return 'A';
        case 0x1: return 'B';
        case 0x2: return 'C';
        case 0x3: return 'D';
        case 0x4: return 'E';
        case 0x5: return 'F';
        case 0x6: return 'G';
        case 0x7: return 'H';
        case 0x8: return 'I';
        case 0x9: return 'J';
        case 0xA: return 'K';
        case 0xB: return 'L';
        case 0xC: return 'FP';
        case 0xD: return 'SP';
        case 0xE: return 'PC';
        case 0xF: return 'FL';
        default: return '?';
      }
    }

    function v8(n) {
      return '0x' + h(n[0], 2);
    }
    
    function v16(n) {
      return '0x' + h(n[1],2) + h(n[0],2)
    }

    let _const = this._const;
    console.log(_const);
    function v32(n) {
      const value = ((n[3] << 24) | (n[2] << 16) | (n[1] << 8) | n[8]) >>> 0;
      console.log(value); console.log(value.toString(16));
      if (value in _const) {
        return _const[value];
      } else {
        return '0x' + h(n[3],2) + h(n[2],2) + h(n[1],2) + h(n[0],2);
      }
    }

    let r = {
      0x01: (p) => [`mov     ${reg(p[0])}, ${reg(p[1])}`, 3],
      0x02: (p) => [`mov     ${reg(p[0])}, ${v8(p[1])}`, 3],
      0x03: (p) => [`mov     ${reg(p[0])}, ${v16(p.slice(1,3))}`, 4],
      0x04: (p) => [`mov     ${reg(p[0])}, ${v32(p.slice(1,5))}`, 6],
      0x05: (p) => [`movb    ${reg(p[0])}, [${reg(p[1])}]`, 3],
      0x06: (p) => [`movb    ${reg(p[0])}, [${v32(p.slice(1,5))}]`, 6],
      0x07: (p) => [`movw    ${reg(p[0])}, [${reg(p[1])}]`, 3],
      0x08: (p) => [`movw    ${reg(p[0])}, [${v32(p.slice(1,5))}]`, 6],
      0x09: (p) => [`movd    ${reg(p[0])}, [${reg(p[1])}]`, 3],
      0x0A: (p) => [`movd    ${reg(p[0])}, [${v32(p.slice(1,5))}]`, 6],

      0x0B: (p) => [`movb    [${reg(p[0])}], ${reg(p[1])}`, 3],
      0x0C: (p) => [`movb    [${reg(p[0])}], ${v8(p[1])}`, 3],
      0x0D: (p) => [`movb    [${reg(p[0])}], [${reg(p[1])}]`, 3],
      0x0E: (p) => [`movb    [${reg(p[0])}], [${v32(p.slice(1,5))}]`, 6],
      0x0F: (p) => [`movw    [${reg(p[0])}], ${reg(p[1])}`, 3],
      0x1A: (p) => [`movw    [${reg(p[0])}], ${v16(p.slice(1,3))}`, 4],
      0x1B: (p) => [`movw    [${reg(p[0])}], [${reg(p[1])}]`, 3],
      0x1C: (p) => [`movw    [${reg(p[0])}], [${v32(p.slice(1,5))}]`, 6],
      0x1D: (p) => [`movd    [${reg(p[0])}], ${reg(p[1])}`, 3],
      0x1E: (p) => [`movd    [${reg(p[0])}], ${v32(p.slice(1,5))}`, 6],
      0x1F: (p) => [`movd    [${reg(p[0])}], [${reg(p[1])}]`, 3],
      0x20: (p) => [`movd    [${reg(p[0])}], [${v32(p.slice(1,5))}]`, 6],

      0x21: (p) => [`movb    [${v32(p.slice(0,4))}], ${reg(p[4])}`, 6],
      0x22: (p) => [`movb    [${v32(p.slice(0,4))}], ${v8(p[4])}`, 6],
      0x23: (p) => [`movb    [${v32(p.slice(0,4))}], [${reg(p[4])}]`, 6],
      0x24: (p) => [`movb    [${v32(p.slice(0,4))}], [${v32(p.slice(4,8))}]`, 9],
      0x25: (p) => [`movw    [${v32(p.slice(0,4))}], ${reg(p[4])}`, 6],
      0x26: (p) => [`movw    [${v32(p.slice(0,4))}], ${v16(p.slice(4,6))}`, 7],
      0x27: (p) => [`movw    [${v32(p.slice(0,4))}], [${reg(p[4])}]`, 6],
      0x28: (p) => [`movw    [${v32(p.slice(0,4))}], [${v32(p.slice(4,8))}]`, 9],
      0x29: (p) => [`movd    [${v32(p.slice(0,4))}], ${reg(p[4])}`, 6],
      0x2A: (p) => [`movd    [${v32(p.slice(0,4))}], ${v32(p.slice(4,8))}`, 9],
      0x2B: (p) => [`movd    [${v32(p.slice(0,4))}], [${reg(p[4])}]`, 6],
      0x2C: (p) => [`movd    [${v32(p.slice(0,4))}], [${v32(p.slice(4,8))}]`, 9],

      0x2D: (p) => [`or      ${reg(p[0])}, ${reg(p[1])}`, 3],
      0x2E: (p) => [`or      ${reg(p[0])}, ${v8(p[1])}`, 3],
      0x2F: (p) => [`or      ${reg(p[0])}, ${v16(p.slice(1,3))}`, 4],
      0x30: (p) => [`or      ${reg(p[0])}, ${v32(p.slice(1,5))}`, 6],
      0x31: (p) => [`xor     ${reg(p[0])}, ${reg(p[1])}`, 3],
      0x32: (p) => [`xor     ${reg(p[0])}, ${v8(p[1])}`, 3],
      0x33: (p) => [`xor     ${reg(p[0])}, ${v16(p.slice(1,3))}`, 4],
      0x34: (p) => [`xor     ${reg(p[0])}, ${v32(p.slice(1,5))}`, 6],
      0x35: (p) => [`and     ${reg(p[0])}, ${reg(p[1])}`, 3],
      0x36: (p) => [`and     ${reg(p[0])}, ${v8(p[1])}`, 3],
      0x37: (p) => [`and     ${reg(p[0])}, ${v16(p.slice(1,3))}`, 4],
      0x38: (p) => [`and     ${reg(p[0])}, ${v32(p.slice(1,5))}`, 6],
      0x39: (p) => [`shl     ${reg(p[0])}, ${reg(p[1])}`, 3],
      0x3A: (p) => [`shl     ${reg(p[0])}, ${v8(p[1])}`, 3],
      0x3B: (p) => [`shr     ${reg(p[0])}, ${reg(p[1])}`, 3],
      0x3C: (p) => [`shr     ${reg(p[0])}, ${v8(p[1])}`, 3],
      0x3D: (p) => [`not     ${reg(p[0])}`, 2],

      0x42: (p) => [`add     ${reg(p[0])}, ${reg(p[1])}`, 3],
      0x43: (p) => [`add     ${reg(p[0])}, ${v8(p[1])}`, 3],
      0x44: (p) => [`add     ${reg(p[0])}, ${v16(p.slice(1,3))}`, 4],
      0x45: (p) => [`add     ${reg(p[0])}, ${v32(p.slice(1,5))}`, 6],
      0x46: (p) => [`sub     ${reg(p[0])}, ${reg(p[1])}`, 3],
      0x47: (p) => [`sub     ${reg(p[0])}, ${v8(p[1])}`, 3],
      0x48: (p) => [`sub     ${reg(p[0])}, ${v16(p.slice(1,3))}`, 4],
      0x49: (p) => [`sub     ${reg(p[0])}, ${v32(p.slice(1,5))}`, 6],
      0x4A: (p) => [`cmp     ${reg(p[0])}, ${reg(p[1])}`, 3],
      0x4B: (p) => [`cmp     ${reg(p[0])}, ${v8(p[1])}`, 3],
      0x4C: (p) => [`cmp     ${reg(p[0])}, ${v16(p.slice(1,3))}`, 4],
      0x4D: (p) => [`cmp     ${reg(p[0])}, ${v32(p.slice(1,5))}`, 6],
      0x4E: (p) => [`mul     ${reg(p[0])}, ${reg(p[1])}`, 3],
      0x4F: (p) => [`mul     ${reg(p[0])}, ${v8(p[1])}`, 3],
      0x50: (p) => [`mul     ${reg(p[0])}, ${v16(p.slice(1,3))}`, 4],
      0x51: (p) => [`mul     ${reg(p[0])}, ${v32(p.slice(1,5))}`, 6],
      0x52: (p) => [`idiv    ${reg(p[0])}, ${reg(p[1])}`, 3],
      0x53: (p) => [`idiv    ${reg(p[0])}, ${v8(p[1])}`, 3],
      0x54: (p) => [`idiv    ${reg(p[0])}, ${v16(p.slice(1,3))}`, 4],
      0x55: (p) => [`idiv    ${reg(p[0])}, ${v32(p.slice(1,5))}`, 6],
      0x56: (p) => [`mod     ${reg(p[0])}, ${reg(p[1])}`, 3],
      0x57: (p) => [`mod     ${reg(p[0])}, ${v8(p[1])}`, 3],
      0x58: (p) => [`mod     ${reg(p[0])}, ${v16(p.slice(1,3))}`, 4],
      0x59: (p) => [`mod     ${reg(p[0])}, ${v32(p.slice(1,5))}`, 6],
      0x5A: (p) => [`inc     ${reg(p[0])}`, 2],
      0x5B: (p) => [`dec     ${reg(p[0])}`, 2],

      0x5C: (p) => [`bz      ${reg(p[0])}`, 2],
      0x5D: (p) => [`bz      ${v32(p.slice(0,4))}`, 5],
      0x5E: (p) => [`bnz     ${reg(p[0])}`, 2],
      0x5F: (p) => [`bnz     ${v32(p.slice(0,4))}`, 5],
      0x60: (p) => [`bneg    ${reg(p[0])}`, 2],
      0x61: (p) => [`bneg    ${v32(p.slice(0,4))}`, 5],
      0x62: (p) => [`bpos    ${reg(p[0])}`, 2],
      0x63: (p) => [`bpos    ${v32(p.slice(0,4))}`, 5],
      0x64: (p) => [`bgt     ${reg(p[0])}`, 2],
      0x65: (p) => [`bgt     ${v32(p.slice(0,4))}`, 5],
      0x66: (p) => [`bgte    ${reg(p[0])}`, 2],
      0x67: (p) => [`bgte    ${v32(p.slice(0,4))}`, 5],
      0x68: (p) => [`blt     ${reg(p[0])}`, 2],
      0x69: (p) => [`blt     ${v32(p.slice(0,4))}`, 5],
      0x6A: (p) => [`blte    ${reg(p[0])}`, 2],
      0x6B: (p) => [`blte    ${v32(p.slice(0,4))}`, 5],
      0x6C: (p) => [`bv      ${reg(p[0])}`, 2],
      0x6D: (p) => [`bv      ${v32(p.slice(0,4))}`, 5],
      0x6E: (p) => [`bnv     ${reg(p[0])}`, 2],
      0x6F: (p) => [`bnv     ${v32(p.slice(0,4))}`, 5],
      0x70: (p) => [`jmp     ${reg(p[0])}`, 2],
      0x71: (p) => [`jmp     ${v32(p.slice(0,4))}`, 5],
      0x72: (p) => [`jsr     ${reg(p[0])}`, 2],
      0x73: (p) => [`jsr     ${v32(p.slice(0,4))}`, 5],
      0x74: (p) => ['ret', 1],
      0x75: (p) => [`sys     ${reg(p[0])}`, 2],
      0x76: (p) => [`sys     ${v8(p[0])}`, 2],
      0x77: (p) => ['iret', 1],
      0x86: (p) => ['sret', 1],

      0x78: (p) => [`pushb   ${reg(p[0])}`, 2],
      0x79: (p) => [`pushb   ${v8(p[0])}`, 2],
      0x7A: (p) => [`pushw   ${reg(p[0])}`, 2],
      0x7B: (p) => [`pushw   ${v16(p.slice(0,2))}`, 3],
      0x7C: (p) => [`pushd   ${reg(p[0])}`, 2],
      0x7D: (p) => [`pushd   ${v32(p.slice(0,4))}`, 5],
      0x7E: (p) => [`push.a`, 1],
      0x7F: (p) => [`popb    ${reg(p[0])}`, 2],
      0x80: (p) => [`popw    ${reg(p[0])}`, 2],
      0x81: (p) => [`popd    ${reg(p[0])}`, 2],
      0x82: (p) => [`pop.a`, 1],
      0x83: (p) => [`popx    ${reg(p[0])}`, 2],
      0x84: (p) => [`popx    ${v8(p[0])}`, 2],
      0x85: (p) => [`popx    ${v16(p.slice(0,2))}`, 3],

      0x87: (p) => ['nop', 1],
    };

    const op = this._vm.mb.get(addr);
    let p = this._vm.mb.getArray(addr+1, 8);

    if (op in r) {
      return r[op](p);
    } else {
      return [`data    0x${v8([op])}`, 1];
    }
  }
}

// vim: ts=2:sw=2:sts=2:expandtab