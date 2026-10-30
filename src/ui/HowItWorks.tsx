/**
 * How the app works, in four steps.
 *
 * Open when the household has logged nothing and collapsed once it has. That
 * is deliberately not a dismissible tour: a tour needs a "seen it" flag, the
 * flag is the kind of state that gets lost when someone clears site data, and
 * the one moment a person most needs instructions is the moment after they
 * lose everything. Tying it to whether the shelf is empty means it is there
 * when it is useful and out of the way when it is not, with nothing stored.
 *
 * Native `details`, so it works with no JavaScript and no library, and the
 * browser handles the keyboard and the screen-reader semantics.
 */
export function HowItWorks({ empty }: { readonly empty: boolean }) {
  return (
    <details className="how" open={empty}>
      <summary>How this works</summary>

      <ol className="how__steps">
        <li>
          <strong>Write down what you already have.</strong> Most households are further
          along than they think — the tap water in the cupboard counts, the rice counts.
          Nothing here is useful until it knows what is on your shelf.
        </li>
        <li>
          <strong>Pick how long you are planning for.</strong> The standard advice is
          three days. You can change it, and the maths runs again on the same shelf and
          tells you what the longer horizon actually costs in things, weight and money.
        </li>
        <li>
          <strong>Do the one thing it says next.</strong> Your figure is days of
          coverage, and it is set by whatever runs out first. The app names that one
          thing and what fixing it does to your number. One item at a time is the whole
          method.
        </li>
        <li>
          <strong>Print the paper version.</strong> A plan that exists only on a phone is
          a plan with a battery dependency. Every sheet here prints in black and white
          and needs no power.
        </li>
      </ol>

      <p className="meta">
        It all works with the radio off. Everything is stored on this device, nothing
        needs an account, and the app has never had a server to send your household
        details to.
      </p>
    </details>
  );
}
