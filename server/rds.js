const { rdsEccLookup, iso, countries } = require("./rds_country.js")

function decode_charset(input) {
    var character = input;
    switch (character) {
      case 0x0A: character = ' '; break;
      case 0x20: character = ' '; break;
      case 0x5E: character = '―'; break;
      case 0x5F: character = '_'; break;
      case 0x60: character = '`'; break;
      case 0x7E: character = '¯'; break;
      case 0x7F: character = ' '; break;
      case 0x80: character = 'á'; break;
      case 0x81: character = 'à'; break;
      case 0x82: character = 'é'; break;
      case 0x83: character = 'è'; break;
      case 0x84: character = 'í'; break;
      case 0x85: character = 'ì'; break;
      case 0x86: character = 'ó'; break;
      case 0x87: character = 'ò'; break;
      case 0x88: character = 'ú'; break;
      case 0x89: character = 'ù'; break;
      case 0x8A: character = 'Ñ'; break;
      case 0x8B: character = 'Ç'; break;
      case 0x8C: character = 'Ş'; break;
      case 0x8D: character = 'β'; break;
      case 0x8E: character = '¡'; break;
      case 0x8F: character = 'Ĳ'; break;
      case 0x90: character = 'â'; break;
      case 0x91: character = 'ä'; break;
      case 0x92: character = 'ê'; break;
      case 0x93: character = 'ë'; break;
      case 0x94: character = 'î'; break;
      case 0x95: character = 'ï'; break;
      case 0x96: character = 'ô'; break;
      case 0x97: character = 'ö'; break;
      case 0x98: character = 'û'; break;
      case 0x99: character = 'ü'; break;
      case 0x9A: character = 'ñ'; break;
      case 0x9B: character = 'ç'; break;
      case 0x9C: character = 'ş'; break;
      case 0x9D: character = 'ǧ'; break;
      case 0x9E: character = 'ı'; break;
      case 0x9F: character = 'ĳ'; break;
      case 0xA0: character = 'ª'; break;
      case 0xA1: character = 'α'; break;
      case 0xA2: character = '©'; break;
      case 0xA3: character = '‰'; break;
      case 0xA4: character = 'Ǧ'; break;
      case 0xA5: character = 'ě'; break;
      case 0xA6: character = 'ň'; break;
      case 0xA7: character = 'ő'; break;
      case 0xA8: character = 'π'; break;
      case 0xA9: character = '€'; break;
      case 0xAA: character = '£'; break;
      case 0xAB: character = '$'; break;
      case 0xAC: character = '←'; break;
      case 0xAD: character = '↑'; break;
      case 0xAE: character = '→'; break;
      case 0xAF: character = '↓'; break;
      case 0xB0: character = 'º'; break;
      case 0xB1: character = '¹'; break;
      case 0xB2: character = '²'; break;
      case 0xB3: character = '³'; break;
      case 0xB4: character = '±'; break;
      case 0xB5: character = 'İ'; break;
      case 0xB6: character = 'ń'; break;
      case 0xB7: character = 'ű'; break;
      case 0xB8: character = 'µ'; break;
      case 0xB9: character = '¿'; break;
      case 0xBA: character = '÷'; break;
      case 0xBB: character = '°'; break;
      case 0xBC: character = '¼'; break;
      case 0xBD: character = '½'; break;
      case 0xBE: character = '¾'; break;
      case 0xBF: character = '§'; break;
      case 0xC0: character = 'Á'; break;
      case 0xC1: character = 'À'; break;
      case 0xC2: character = 'É'; break;
      case 0xC3: character = 'È'; break;
      case 0xC4: character = 'Í'; break;
      case 0xC5: character = 'Ì'; break;
      case 0xC6: character = 'Ó'; break;
      case 0xC7: character = 'Ò'; break;
      case 0xC8: character = 'Ú'; break;
      case 0xC9: character = 'Ù'; break;
      case 0xCA: character = 'Ř'; break;
      case 0xCB: character = 'Č'; break;
      case 0xCC: character = 'Š'; break;
      case 0xCD: character = 'Ž'; break;
      case 0xCE: character = 'Ð'; break;
      case 0xCF: character = 'Ŀ'; break;
      case 0xD0: character = 'Â'; break;
      case 0xD1: character = 'Ä'; break;
      case 0xD2: character = 'Ê'; break;
      case 0xD3: character = 'Ë'; break;
      case 0xD4: character = 'Î'; break;
      case 0xD5: character = 'Ï'; break;
      case 0xD6: character = 'Ô'; break;
      case 0xD7: character = 'Ö'; break;
      case 0xD8: character = 'Û'; break;
      case 0xD9: character = 'Ü'; break;
      case 0xDA: character = 'ř'; break;
      case 0xDB: character = 'č'; break;
      case 0xDC: character = 'š'; break;
      case 0xDD: character = 'ž'; break;
      case 0xDE: character = 'đ'; break;
      case 0xDF: character = 'ŀ'; break;
      case 0xE0: character = 'Ã'; break;
      case 0xE1: character = 'Å'; break;
      case 0xE2: character = 'Æ'; break;
      case 0xE3: character = 'Œ'; break;
      case 0xE4: character = 'ŷ'; break;
      case 0xE5: character = 'Ý'; break;
      case 0xE6: character = 'Õ'; break;
      case 0xE7: character = 'Ø'; break;
      case 0xE8: character = 'Þ'; break;
      case 0xE9: character = 'Ŋ'; break;
      case 0xEA: character = 'Ŕ'; break;
      case 0xEB: character = 'Ć'; break;
      case 0xEC: character = 'Ś'; break;
      case 0xED: character = 'Ź'; break;
      case 0xEE: character = 'Ŧ'; break;
      case 0xEF: character = 'ð'; break;
      case 0xF0: character = 'ã'; break;
      case 0xF1: character = 'å'; break;
      case 0xF2: character = 'æ'; break;
      case 0xF3: character = 'œ'; break;
      case 0xF4: character = 'ŵ'; break;
      case 0xF5: character = 'ý'; break;
      case 0xF6: character = 'õ'; break;
      case 0xF7: character = 'ø'; break;
      case 0xF8: character = 'þ'; break;
      case 0xF9: character = 'ŋ'; break;
      case 0xFA: character = 'ŕ'; break;
      case 0xFB: character = 'ć'; break;
      case 0xFC: character = 'ś'; break;
      case 0xFD: character = 'ź'; break;
      case 0xFE: character = 'ŧ'; break;
      case 0xFF: character = ' '; break;
      default: character = String.fromCharCode(input); break;
    }
    return character
}

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
    const a_error = (error >> 6) & 3;
    const b_error = (error >> 4) & 3;
    const c_error = (error >> 2) & 3;
    const d_error = error & 3;

    if(this.last_pi_error > a_error) {
        this.data.pi = blockA.toString(16).toUpperCase().padStart(4, '0');
        this.last_pi_error = a_error;
    }

    if(b_error !== 0) return; // B chooses what group this is, if this has errors, we are screwed

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

        this.ps[idx * 2] = decode_charset(blockD >> 8);
        this.ps[idx * 2 + 1] = decode_charset(blockD & 0xFF);
        this.ps_errors[idx * 2] = Math.ceil(d_error * (10/3));
        this.ps_errors[idx * 2 + 1] = Math.ceil(d_error * (10/3));

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
                this.rt1[idx * multiplier] = decode_charset(blockC >> 8);
                this.rt1[idx * multiplier + 1] = decode_charset(blockC & 0xFF);
                this.rt1_errors[idx * multiplier] = Math.ceil(c_error * (10/3));
                this.rt1_errors[idx * multiplier + 1] = Math.ceil(c_error * (10/3));
            }
            if(d_error < 2) {
                var offset = (multiplier == 2) ? 0 : 2;
                this.rt1[idx * multiplier + offset] = decode_charset(blockD >> 8);
                this.rt1[idx * multiplier + offset + 1] = decode_charset(blockD & 0xFF);
                this.rt1_errors[idx * multiplier + offset] = Math.ceil(d_error * (10/3));
                this.rt1_errors[idx * multiplier + offset + 1] = Math.ceil(d_error * (10/3));
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
                this.rt0[idx * multiplier] = decode_charset(blockC >> 8);
                this.rt0[idx * multiplier + 1] = decode_charset(blockC & 0xFF);
                this.rt0_errors[idx * multiplier] = Math.ceil(c_error * (10/3));
                this.rt0_errors[idx * multiplier + 1] = Math.ceil(c_error * (10/3));
            }
            if(d_error !== 3) {
                var offset = (multiplier == 2) ? 0 : 2;
                this.rt0[idx * multiplier + offset] = decode_charset(blockD >> 8);
                this.rt0[idx * multiplier + offset + 1] = decode_charset(blockD & 0xFF);
                this.rt0_errors[idx * multiplier + offset] = Math.ceil(d_error * (10/3));
                this.rt0_errors[idx * multiplier + offset + 1] = Math.ceil(d_error * (10/3));
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