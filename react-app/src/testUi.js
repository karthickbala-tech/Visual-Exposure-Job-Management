// Helpers for tests of screens built with shadcn/ui (Radix). jsdom has no PointerEvent, so menus open on a
// synthetic pointerdown and tabs on mousedown, the events Radix listens for.
import { act } from 'react';

export const fire = (el, type, init = {}) => act(() => { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init })); });
export const click = (el) => fire(el, 'click');
export const openMenu = (trigger) => fire(trigger, 'pointerdown');
export const pickTab = (tab) => fire(tab, 'mousedown');
export const byLabel = (label, scope = document) => scope.querySelector(`[aria-label="${label}"]`);
export const menuItem = (text) => [...document.querySelectorAll('[role="menuitem"]')].find((m) => m.textContent.trim().startsWith(text));
export const tab = (text) => [...document.querySelectorAll('[role="tab"]')].find((t) => t.textContent.trim().startsWith(text));
export const dialog = () => [...document.querySelectorAll('[role="dialog"]')].pop();
