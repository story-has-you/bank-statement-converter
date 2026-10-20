import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, test } from "node:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createTranslator } from "next-intl";

import { AiChatLinks } from "@/components/shared/ai-chat-links";
import { routing } from "@/i18n/routing";
import { getAgentDocumentUrl, getAiChatLinks } from "@/lib/geo/links";

const window = new Window({ url: "https://statementxl.test" });
Object.assign(globalThis, {
  window,
  document: window.document,
  HTMLElement: window.HTMLElement,
  HTMLInputElement: window.HTMLInputElement,
  HTMLTextAreaElement: window.HTMLTextAreaElement,
  MutationObserver: window.MutationObserver,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, "navigator", { configurable: true, value: window.navigator });
after(() => window.happyDOM.abort());

const labelKeys = ["showPrompt", "linkInstructions", "pasteInstructions", "copyPrompt", "copying", "copied", "copyFailed"] as const;

function propsFor(locale: (typeof routing.locales)[number]) {
  const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
  const t = createTranslator({ locale, messages, namespace: "Geo" });
  const labels = Object.fromEntries(labelKeys.map((key) => [key, t(key)])) as Record<(typeof labelKeys)[number], string>;
  return {
    prompt: t("prompt", {
      fullUrl: getAgentDocumentUrl(locale, "llms-full.txt"),
      indexUrl: getAgentDocumentUrl(locale, "llms.txt"),
      language: messages.LanguageSwitcher[locale],
    }),
    description: t("chatDescription"),
    labels,
    language: messages.LanguageSwitcher[locale] as string,
  };
}

async function mount(locale: (typeof routing.locales)[number] = "en") {
  const props = propsFor(locale);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<AiChatLinks {...props} />));
  const button = container.querySelector("button")!;
  const textarea = container.querySelector("textarea")!;
  const status = container.querySelector('[role="status"]')!;
  return {
    props,
    container,
    button,
    textarea,
    status,
    async cleanup() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

function setClipboard(value: unknown) {
  Object.defineProperty(window.navigator, "clipboard", { configurable: true, value });
}

for (const locale of routing.locales) {
  test(`${locale}: localized instructions, source URLs, language and complete prompt reach every provider`, async () => {
    const view = await mount(locale);
    try {
      const { prompt, labels, language } = view.props;
      assert.ok(prompt.includes(getAgentDocumentUrl(locale, "llms-full.txt")));
      assert.ok(prompt.includes(getAgentDocumentUrl(locale, "llms.txt")));
      assert.ok(prompt.includes(language));
      assert.ok(!/\{(?:fullUrl|indexUrl|language)\}/.test(prompt));
      for (const key of labelKeys) {
        assert.ok(labels[key].trim().length > 0);
        assert.notEqual(labels[key], `Geo.${key}`);
      }
      assert.equal(view.textarea.value, prompt);
      assert.equal(view.textarea.readOnly, true);
      const groups = view.container.querySelectorAll('[role="group"][aria-labelledby]');
      assert.equal(groups.length, 2);
      assert.ok(groups[0].textContent?.includes(labels.linkInstructions));
      assert.ok(groups[1].textContent?.includes(labels.pasteInstructions));
      for (const provider of getAiChatLinks(prompt)) {
        const anchor = view.container.querySelector(`a[href="${provider.href}"]`)!;
        assert.ok(anchor);
        assert.equal(anchor.textContent, provider.name);
        assert.equal(anchor.getAttribute("target"), "_blank");
        assert.equal(anchor.getAttribute("rel"), "noopener noreferrer");
        assert.ok(document.getElementById(anchor.getAttribute("aria-describedby")!));
        const url = new URL(provider.href);
        if (provider.promptMode === "link") {
          assert.equal(url.searchParams.get("q"), prompt);
          assert.ok(groups[0].contains(anchor));
        } else {
          assert.equal(url.search, "");
          assert.ok(groups[1].contains(anchor));
        }
      }
      // Native controls retain keyboard focusability and an accessible prompt label.
      view.button.focus();
      assert.equal(document.activeElement, view.button);
      assert.equal(view.button.type, "button");
      const summary = view.container.querySelector("summary")!;
      assert.equal(summary.textContent, labels.showPrompt);
      assert.ok(view.container.querySelector(`label[for="${view.textarea.id}"]`));
    } finally {
      await view.cleanup();
    }
  });
}

test("copy writes the exact localized prompt, announces success and opens no external page", async () => {
  const view = await mount("zh-CN");
  const writes: string[] = [];
  setClipboard({
    writeText: async (text: string) => {
      writes.push(text);
    },
  });
  try {
    await act(async () => view.button.click());
    assert.deepEqual(writes, [view.props.prompt]);
    assert.equal(view.status.textContent, view.props.labels.copied);
    assert.equal(view.status.getAttribute("role"), "status");
    assert.equal(window.location.href, "https://statementxl.test/");
    assert.equal(window.happyDOM.virtualConsolePrinter.readAsString(), "");
  } finally {
    await view.cleanup();
  }
});

for (const failure of ["permission denied", "API missing"]) {
  test(`${failure}: reveals and selects a keyboard-focusable manual fallback; retry can succeed`, async () => {
    setClipboard(
      failure === "API missing"
        ? undefined
        : {
            writeText: async () => {
              throw new Error("NotAllowedError");
            },
          },
    );
    const view = await mount();
    try {
      await act(async () => view.button.click());
      assert.equal(view.status.textContent, view.props.labels.copyFailed);
      assert.equal(view.container.querySelector("details")!.open, true);
      assert.equal(document.activeElement, view.textarea);
      assert.equal(view.textarea.selectionStart, 0);
      assert.equal(view.textarea.selectionEnd, view.props.prompt.length);
      assert.equal(view.container.querySelectorAll('a[target="_blank"]').length, 5);
      setClipboard({ writeText: async () => {} });
      await act(async () => view.button.click());
      assert.equal(view.status.textContent, view.props.labels.copied);
    } finally {
      await view.cleanup();
    }
  });
}

test("pending clipboard request disables repeated copies and exposes progress", async () => {
  let finish!: () => void;
  let calls = 0;
  setClipboard({
    writeText: () => {
      calls++;
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    },
  });
  const view = await mount();
  try {
    await act(async () => view.button.click());
    assert.equal(view.button.disabled, true);
    assert.equal(view.button.textContent, view.props.labels.copying);
    await act(async () => view.button.click());
    assert.equal(calls, 1);
    await act(async () => finish());
    assert.equal(view.button.disabled, false);
    assert.equal(view.status.textContent, view.props.labels.copied);
  } finally {
    await view.cleanup();
  }
});

test("multiple footers keep distinct prompt labels and instruction IDs", async () => {
  const first = await mount();
  const second = await mount("zh-CN");
  try {
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.notEqual(first.textarea.id, second.textarea.id);
  } finally {
    await first.cleanup();
    await second.cleanup();
  }
});
