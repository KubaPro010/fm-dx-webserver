const { rdsEccLookup, iso, countries } = require("./rds_country.js")

class RDSDecoder {
  constructor(data) {
    this.data = data;
    this.clear()
  }

  clear() {
    this.data.pi = '?';
    this.ps = Array(8).fill(' ');
    this.ps_errors = Array(8).fill("0");
    this.rt0 = Array(64).fill(' ');
    this.rt0_errors = Array(64).fill("0");
    this.rt1 = Array(64).fill(' ');
    this.rt1_errors = Array(64).fill("0");
    this.data.ps = '';
    this.data.rt1 = '';
    this.data.rt0 = '';
    this.data.pty = 0;
    this.data.tp = 0;
    this.data.ta = 0;
    this.data.ms = -1;
    this.data.rt_flag = 0;
    this.rt1_to_clear = false;
    this.rt0_to_clear = false;
    this.data.ecc = null;
    this.data.country_name = ""
    this.data.country_iso = "UN"

    this.af_len = 0;
    this.data.af = []
    this.af_am_follows = false;

    this.last_pi_error = 0;
  }

  decodeGroup(blockA, blockB, blockC, blockD, error) {
    const a_error = (error & 0xC0) >> 6;
    const b_error = (error & 0x30) >> 4;
    const c_error = (error & 0xc) >> 2;
    const d_error = error & 3;

    if(this.last_pi_error > a_error) {
        this.data.pi = blockA.toString(16).toUpperCase().padStart(4, '0');
        this.last_pi_error = a_error;
    }

    if(b_error != 0) return; // B chooses what group this is, if this has errors, we are screwed

    const group = (blockB >> 12) & 0xF;
    const version = (blockB >> 11) & 0x1;
    this.data.tp = Number((blockB >> 10) & 1);
    this.data.pty = (blockB >> 5) & 31;

    if (group === 0) {
        this.data.ta = (blockB >> 4) & 1;
        this.data.ms = (blockB >> 3) & 1;

        if(version === 0 && c_error !== 3) {
            var af_high = blockC >> 8;
            var af_low = blockC & 0xFF;
            var BASE = 224;
            var FILLER = 205;
            var AM_FOLLOWS = 250;

            if(af_high >= BASE && af_high <= (BASE+25)) {
                this.af_len = af_high-BASE;
                if(this.af_len !== this.data.af.length)  {
                    this.data.af = [];
                    this.af_am_follows = false;

                    if(af_low != FILLER && af_low != AM_FOLLOWS) this.data.af.push((af_low+875)*100)
                    else if(af_low == AM_FOLLOWS) this.af_am_follows = true;
                }
            } else if(this.data.af.length != this.af_len) {
                if(!(af_high == AM_FOLLOWS || this.af_am_follows)) {
                    var freq = (af_high+875)*100;
                    if(!this.data.af.includes(freq)) this.data.af.push(freq);
                }
                if(this.af_am_follows) this.af_am_follows = false;
                if(!(af_high == AM_FOLLOWS || af_low == FILLER || af_low == AM_FOLLOWS)) {
                    var freq = (af_low+875)*100;
                    if(!this.data.af.includes(freq)) this.data.af.push(freq);
                }
                if(af_low == AM_FOLLOWS) this.af_am_follows = true;
            }
        }

        if(d_error > 2) return; // Don't risk it

        const idx = blockB & 0x3;

        this.ps[idx * 2] = String.fromCharCode(blockD >> 8);
        this.ps[idx * 2 + 1] = String.fromCharCode(blockD & 0xFF);
        this.ps_errors[idx * 2] = error;
        this.ps_errors[idx * 2 + 1] = error;

        this.data.ps = this.ps.join('');
        this.data.ps_errors = this.ps_errors.join(',');
    } else if (group === 1 && version === 0) {
        if(c_error > 2) return;
        var variant_code = (blockC >> 12) & 0x7;
        switch (variant_code) {
            case 0:
                this.data.ecc = blockC & 0xff;
                this.data.country_name = rdsEccLookup(blockA, this.data.ecc);
                if(this.data.country_name.length === 0) this.data.country_iso = "UN";
                else this.data.country_iso = iso[countries.indexOf(this.data.country_name)]
                break;
            default: break;
        }
    } else if (group === 2) {
        const idx = blockB & 0b1111;
        this.rt_ab = Boolean((blockB >> 4) & 1);
        var multiplier = (version == 0) ? 4 : 2;
        if(this.rt_ab) {
            if(this.rt1_to_clear) {
                this.rt1 = Array(64).fill(' ');
                this.rt1_errors = Array(64).fill("0");
                this.rt1_to_clear = false;
            }

            if(c_error < 2 && multiplier !== 2) {
                this.rt1[idx * multiplier] = String.fromCharCode(blockC >> 8);
                this.rt1[idx * multiplier + 1] = String.fromCharCode(blockC & 0xFF);
                this.rt1_errors[idx * multiplier] = error;
                this.rt1_errors[idx * multiplier + 1] = error;
            }
            if(d_error < 2) {
                var offset = (multiplier == 2) ? 0 : 2;
                this.rt1[idx * multiplier + offset] = String.fromCharCode(blockD >> 8);
                this.rt1[idx * multiplier + offset + 1] = String.fromCharCode(blockD & 0xFF);
                this.rt1_errors[idx * multiplier + offset] = error;
                this.rt1_errors[idx * multiplier + offset + 1] = error;
            }

            var i = this.rt1.indexOf("\r")
            while(i != -1) {
                this.rt1[i] = " ";
                i = this.rt1.indexOf("\r");
            }

            this.data.rt1 = this.rt1.join('');
            this.data.rt1_errors = this.rt1_errors.join(',');
            this.data.rt_flag = 1;
            this.rt0_to_clear = true;
        } else {
            if(this.rt0_to_clear) {
                this.rt0 = Array(64).fill(' ');
                this.rt0_errors = Array(64).fill("0");
                this.rt0_to_clear = false;
            }

            if(c_error !== 3 && multiplier !== 2) {
                this.rt0[idx * multiplier] = String.fromCharCode(blockC >> 8);
                this.rt0[idx * multiplier + 1] = String.fromCharCode(blockC & 0xFF);
                this.rt0_errors[idx * multiplier] = error;
                this.rt0_errors[idx * multiplier + 1] = error;
            }
            if(d_error !== 3) {
                var offset = (multiplier == 2) ? 0 : 2;
                this.rt0[idx * multiplier + offset] = String.fromCharCode(blockD >> 8);
                this.rt0[idx * multiplier + offset + 1] = String.fromCharCode(blockD & 0xFF);
                this.rt0_errors[idx * multiplier + offset] = error;
                this.rt0_errors[idx * multiplier + offset + 1] = error;
            }

            var i = this.rt0.indexOf("\r");
            while(i != -1) {
                this.rt0[i] = " ";
                i = this.rt0.indexOf("\r");
            }

            this.data.rt0 = this.rt0.join('');
            this.data.rt0_errors = this.rt0_errors.join(',');
            this.data.rt_flag = 0;
            this.rt1_to_clear = true;
        }
    } else {
        // console.log(group, version)
    }
  }
}
module.exports = RDSDecoder;