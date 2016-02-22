import Device from './device';

export default class Storage extends Device {

  constructor(units) {
    super();

    // check sanity
    if (units === undefined || units.constructor !== Array) {
      throw new Error('`units` must be an array.');
    }
    if (units.length > 4) {
      throw new Error('Maximum of 4 units');
    }
    for (const u of units) {
      if (!u.get || !u.set || !u.size) {
        throw new Error('Missing method in unit');
      }
    }

    // STG_OP commands
    this.STG_OP_READ  = 0x1;
    this.STG_OP_WRITE = 0x2;
    this.STG_OP_SIZE  = 0x3;

    // STG_MODE options
    this.STG_MODE_POLL      = 0x0;
    this.STG_MODE_INTERRUPT = 0x1;

    // STG_OP_STATUS responses
    this.STG_STATUS_DONE           = 0x0;
    this.STG_STATUS_WAITING        = 0x1;
    this.STG_STATUS_ADDRESS_ERROR  = 0x2;
    this.STG_STATUS_UNAVALIABLE    = 0x3;
    this.STG_STATUS_PHYSICAL_ERROR = 0x4;

    // initialize
    this._units = units;
    this._const = this.constantList();

    this._mode = this.STG_MODE_POLL;
    this._status = this.STG_STATUS_OK;
    this._p = new Uint32Array(8);
    this._r = new Uint32Array(2);
  }

  name() { return 'TinyStorage'; }
  deviceType() { return Device.Type.STORAGE; }
  version() { return 0x0; }
  hasInterrupt() { return true; }

  constantList() {
    return {
      STG_TYPE:      0x00,
      STG_VERSION:   0x01,
      STG_INTERRUPT: 0x02,
      STG_NAME:      0x03,
      STG_MODE:      0x10,
      STG_DONE:      0x11,
      STG_UNIT_LIST: 0x12,
      STG_OP:        0x13,
      STG_P0:        0x14,
      STG_P1:        0x18,
      STG_P2:        0x1C,
      STG_P3:        0x20,
      STG_P4:        0x24,
      STG_P5:        0x28,
      STG_P6:        0x2C,
      STG_P7:        0x30,
      STG_R0:        0x34,
      STG_R1:        0x38,
    };
  }


  get(a) {
    if (a < 0x10) {
      return super.get(a);
    } else if (a == this._const.STG_MODE) {
      return this._mode;
    } else if (a == this._const.STG_OP_STATUS) {
      return this._status;
    } else if (a == this._const.STG_UNIT_LIST) {  // unit list
      let n = 0;
      for (let i in this._units) { n <<= 1; n |= 1; }
      return n;
    } else {
      let v;
      if (a >= this._const.STG_P0 && a < this._const.STG_P0 + 0x20) {
        v = this._p[Math.floor((a - this._const.STG_P0) / 4)];
      } else if (a >= this._const.STG_R0 && a < this._const.STG_R0 + 0x8) {
        v = this._r[Math.floor((a - this._const.STG_R0) / 4)];
      }
      if (v !== undefined) {
        switch (a % 4) {
          case 0: return v & 0xFF;
          case 1: return (v >> 8) & 0xFF;
          case 2: return (v >> 16) & 0xFF;
          case 3: return (v >> 24) & 0xFF;
        }
      }
    }
    return 0;
  }


  set(a, v) {
    if (a < 0x10) {
      super.set(a, v);
    } else if (a == this._const.STG_MODE) {
      this._mode = (a == 0 ? this.STG_MODE_POLL : this.STG_MODE_INTERRUPT);
    } else if (a == this._const.STG_OP) {
      this._r = this._execute(v);
    } else {
      let r, arr;
      if (a >= this._const.STG_P0 && a < this._const.STG_P0 + 0x20) {
        r = Math.floor((a - this._const.STG_P0) / 4);
        arr = this._p;
      /* } else if (a >= this._const.STG_R0 && a < this._const.STG_R0 + 0x8) {
        r = Math.floor((a - this._const.STG_R0) / 4);
        arr = this._r; */
      }
      if (arr) {
        switch (a % 4) {
          case 0: 
            arr[r] &= ~0xFF; arr[r] |= v;
            break;
          case 1: 
            arr[r] &= ~0xFF00; arr[r] |= (v << 8);
            break;
          case 2: 
            arr[r] &= ~0xFF0000; arr[r] |= (v << 16);
            break;
          case 3: 
            arr[r] &= ~0xFF000000; arr[r] |= (v << 24);
            break;
        }
      }
    }
  }


  fireInterrupt(status) {
    this._status = status;
    if (this._mode == this.STG_MODE_INTERRUPT) {
      super.fireInterrupt();
    }
  }


  _execute(op) {
    switch(op) {
      case this.STG_OP_SIZE:
        if (this._p[0] > this._units.length) {
          this.fireInterrupt(this.STG_STATUS_UNAVALIABLE);
        } else {
          const r = this._units[this._p[0]].size;
          console.log(r);
          console.log(r >>> 32);
          return [r & 0xFFFFFFFF, r >> 32];
        }
        break;
    }
    return [0, 0];
  }

};

// vim: ts=2:sw=2:sts=2:expandtab
