/// Minimal SHA-256 (FIPS 180-4) used to store password keys and password
/// session tokens as hashes, never in the clear.
import Nat8 "mo:core/Nat8";
import Nat32 "mo:core/Nat32";
import Blob "mo:core/Blob";
import VarArray "mo:core/VarArray";
import Array "mo:core/Array";
import Nat "mo:core/Nat";

module {

  let K : [Nat32] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  /// SHA-256 of a byte blob, returned as a 32-byte blob.
  public func hash(data : Blob) : Blob {
    let msg = Blob.toArray(data);
    let len = msg.size();

    // Padding: 0x80, zeros, then the 64-bit big-endian bit length.
    var padded = len + 1;
    while (padded % 64 != 56) { padded += 1 };
    let total = padded + 8;
    let buf = VarArray.repeat<Nat8>(0, total);
    var i = 0;
    while (i < len) { buf[i] := msg[i]; i += 1 };
    buf[len] := 0x80;
    let bitLen = len * 8;
    var j = 0;
    while (j < 8) {
      buf[total - 1 - j] := Nat.toNat8((bitLen / (256 ** j)) % 256);
      j += 1;
    };

    let h = Array.toVarArray<Nat32>([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ]);
    let w = VarArray.repeat<Nat32>(0, 64);

    var block = 0;
    while (block < total) {
      var t = 0;
      while (t < 16) {
        let o = block + t * 4;
        w[t] := (Nat8.toNat32(buf[o]) << 24) | (Nat8.toNat32(buf[o + 1]) << 16)
              | (Nat8.toNat32(buf[o + 2]) << 8) | Nat8.toNat32(buf[o + 3]);
        t += 1;
      };
      while (t < 64) {
        let s0 = (w[t - 15] <>> 7) ^ (w[t - 15] <>> 18) ^ (w[t - 15] >> 3);
        let s1 = (w[t - 2] <>> 17) ^ (w[t - 2] <>> 19) ^ (w[t - 2] >> 10);
        w[t] := w[t - 16] +% s0 +% w[t - 7] +% s1;
        t += 1;
      };

      var a = h[0]; var b = h[1]; var c = h[2]; var d = h[3];
      var e = h[4]; var f = h[5]; var g = h[6]; var hh = h[7];

      t := 0;
      while (t < 64) {
        let S1 = (e <>> 6) ^ (e <>> 11) ^ (e <>> 25);
        let ch = (e & f) ^ ((^ e) & g);
        let temp1 = hh +% S1 +% ch +% K[t] +% w[t];
        let S0 = (a <>> 2) ^ (a <>> 13) ^ (a <>> 22);
        let maj = (a & b) ^ (a & c) ^ (b & c);
        let temp2 = S0 +% maj;
        hh := g; g := f; f := e; e := d +% temp1;
        d := c; c := b; b := a; a := temp1 +% temp2;
        t += 1;
      };

      h[0] := h[0] +% a; h[1] := h[1] +% b; h[2] := h[2] +% c; h[3] := h[3] +% d;
      h[4] := h[4] +% e; h[5] := h[5] +% f; h[6] := h[6] +% g; h[7] := h[7] +% hh;
      block += 64;
    };

    let out = VarArray.repeat<Nat8>(0, 32);
    var k = 0;
    while (k < 8) {
      out[k * 4] := Nat32.toNat8(h[k] >> 24);
      out[k * 4 + 1] := Nat32.toNat8((h[k] >> 16) & 0xff);
      out[k * 4 + 2] := Nat32.toNat8((h[k] >> 8) & 0xff);
      out[k * 4 + 3] := Nat32.toNat8(h[k] & 0xff);
      k += 1;
    };
    Array.toBlob(VarArray.toArray(out));
  };
};
