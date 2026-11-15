import test from "node:test";
import assert from "node:assert/strict";
import { passwordProblem, resetTokenFromSearch } from "../src/lib/password-reset.ts";

test("reads the reset token from the address the e-mail points to", () => {
  assert.equal(resetTokenFromSearch("?reset=abcDEF123_-xyzABCdef123"), "abcDEF123_-xyzABCdef123");
  assert.equal(resetTokenFromSearch("reset=abcDEF123_-xyzABCdef123&x=1"), "abcDEF123_-xyzABCdef123");
});

test("ignores an absent, short or malformed token", () => {
  assert.equal(resetTokenFromSearch(""), null);
  assert.equal(resetTokenFromSearch("?reset="), null);
  assert.equal(resetTokenFromSearch("?reset=curto"), null);
  assert.equal(resetTokenFromSearch("?reset=" + "a".repeat(19)), null);
  assert.equal(resetTokenFromSearch("?reset=" + "a".repeat(201)), null);
  assert.equal(resetTokenFromSearch("?reset=espa%C3%A7o%20na%20url"), null);
  assert.equal(resetTokenFromSearch("?reset=<script>alert(1)</script>"), null);
});

test("requires eight characters and every character category", () => {
  assert.equal(passwordProblem("Ab1234@"), "A senha deve ter pelo menos 8 caracteres.");
  assert.equal(passwordProblem("Abc1234@"), null);
  for (const password of ["abc1234@", "ABC1234@", "Abcdefg@", "Abc12345", "Abc1234~"]) {
    assert.match(passwordProblem(password), /maiúscula/);
  }
});

test("recognizes every listed symbol, including backslash and cedilla", () => {
  for (const symbol of "@#$%&*()_-=+/\\|ç{[}]'!;:?") {
    assert.equal(passwordProblem("Abc1234" + symbol), null);
  }
});

test("requires the confirmation to match", () => {
  assert.equal(passwordProblem("Abc1234@", "outraSenha123"), "As senhas não coincidem.");
  assert.equal(passwordProblem("Abc1234@", "Abc1234@"), null);
});

test("rejects an oversized password", () => {
  assert.equal(passwordProblem("a".repeat(129)), "A senha deve ter no máximo 128 caracteres.");
});
