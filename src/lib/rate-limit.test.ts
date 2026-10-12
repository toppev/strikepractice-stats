import { test } from "node:test";
import assert from "node:assert/strict";
import { bucket, clientIp, hit, isPrivate } from "./rate-limit";

test("allows the limit per minute, then says how long to wait", () => {
  const start = 1_000_000;
  for (let i = 0; i < 3; i++) assert.equal(hit("198.51.100.1", 3, start + i), 0);
  assert.equal(hit("198.51.100.1", 3, start + 30_000), 30);
  // Other visitors have their own count
  assert.equal(hit("198.51.100.2", 3, start + 30_000), 0);
  // A new minute starts over
  assert.equal(hit("198.51.100.1", 3, start + 60_000), 0);
});

test("the visitor's address is the last X-Forwarded-For entry, or Cloudflare's header", () => {
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "198.51.100.7" })), "198.51.100.7");
  // Anything before the last entry came from the client and may be made up
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "203.0.113.9, 198.51.100.7" })), "198.51.100.7");
  const viaCloudflare = new Headers({ "cf-connecting-ip": "2001:db8::5", "x-forwarded-for": "198.51.100.7" });
  assert.equal(clientIp(viaCloudflare, true), "2001:db8::5");
  // Not behind Cloudflare, the header is the visitor's own (a private one would skip the limit)
  assert.equal(clientIp(viaCloudflare), "198.51.100.7");
  assert.equal(clientIp(new Headers({ "cf-connecting-ip": "10.0.0.1", "x-forwarded-for": "198.51.100.7" })), "198.51.100.7");
  assert.equal(clientIp(new Headers()), undefined);
});

test("private and loopback addresses are told apart from public ones", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.17.0.1", "172.31.255.255", "192.168.65.1", "::1", "::ffff:172.18.0.1", "fd00::1", "fe80::1"]) {
    assert.equal(isPrivate(ip), true, ip);
  }
  for (const ip of ["198.51.100.7", "172.32.0.1", "11.0.0.1", "2001:db8::5", "::ffff:198.51.100.7"]) {
    assert.equal(isPrivate(ip), false, ip);
  }
});

test("searches have their own, bigger count", () => {
  const page = bucket("/player/someone", "198.51.100.3", 2);
  const search = bucket("/api/search", "198.51.100.3", 2);
  assert.equal(search.limit, 8);
  const start = 2_000_000;
  for (let i = 0; i < 8; i++) assert.equal(hit(search.key, search.limit, start), 0);
  assert.notEqual(hit(search.key, search.limit, start), 0);
  // Typing in the search box didn't use up page views
  assert.equal(hit(page.key, page.limit, start), 0);
});
