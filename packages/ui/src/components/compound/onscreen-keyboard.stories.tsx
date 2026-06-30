import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { OnscreenKeyboard } from "./onscreen-keyboard";

/**
 * `OnscreenKeyboard` renders a standard QWERTY on-screen keyboard.
 * Each letter key can reflect a state (correct / present / absent) via `letterStates`,
 * making it suitable for any guessing or input game.
 *
 * **Controls**: Edit `letterStates` as JSON in the panel to see key colors update live,
 * or toggle `disabled` to see the game-over state.
 */
const meta = {
  title: "Patterns/Input/OnscreenKeyboard",
  component: OnscreenKeyboard,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: { canvas: { sourceState: "shown" } },
  },
  argTypes: {
    letterStates: {
      control: "object",
      description:
        'Maps uppercase letters to their state. Values: `"absent"` | `"present"` | `"correct"`.',
    },
    disabled: {
      control: "boolean",
      description: "Disables all keys. Use when the game has ended.",
    },
    onLetter: { control: false },
    onEnter: { control: false },
    onBackspace: { control: false },
  },
  args: {
    onLetter: fn(),
    onEnter: fn(),
    onBackspace: fn(),
  },
} as Meta<typeof OnscreenKeyboard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** All keys in their resting state — no guesses submitted yet. */
export const Default: Story = {
  args: { letterStates: {} },
};

/**
 * Mid-game snapshot: green keys are confirmed correct, amber are present in the
 * word but misplaced, and gray keys have been ruled out.
 */
export const WithProgress: Story = {
  args: {
    letterStates: {
      K: "correct",
      Y: "correct",
      L: "present",
      E: "present",
      A: "absent",
      S: "absent",
      T: "absent",
      R: "absent",
      N: "absent",
      I: "absent",
      O: "absent",
    },
  },
};

/** Shows all three state colors at once for quick visual reference. */
export const AllStatesSwatch: Story = {
  args: {
    letterStates: {
      Q: "correct",
      W: "present",
      E: "absent",
      R: "correct",
      T: "present",
      Y: "absent",
      U: "correct",
      I: "present",
      O: "absent",
    },
  },
};

/** All keys disabled — rendered after the game ends (win or loss). */
export const Disabled: Story = {
  args: {
    disabled: true,
    letterStates: {
      K: "correct",
      Y: "correct",
      L: "present",
      A: "absent",
      S: "absent",
    },
  },
};

/**
 * Interaction test: clicking a letter fires `onLetter`, Enter fires `onEnter`,
 * and the backspace button fires `onBackspace`.
 */
export const ClickCallbacks: Story = {
  args: { letterStates: {} },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "A" }));
    await expect(args.onLetter).toHaveBeenCalledWith("A");

    await userEvent.click(canvas.getByRole("button", { name: "Enter" }));
    await expect(args.onEnter).toHaveBeenCalled();

    await userEvent.click(canvas.getByRole("button", { name: "⌫" }));
    await expect(args.onBackspace).toHaveBeenCalled();
  },
};
