import { APP_VERSION } from "../models/appInfo";

/** Manage → About Enough Money (v0.52.0): what the app is, and its version. */
export function About() {
  return (
    <section className="list-card about-page" aria-labelledby="about-title">
      <div className="section-heading">
        <h2 id="about-title">About Enough Money</h2>
      </div>
      <p>
        Enough Money is an envelope budget for your household. Money that comes in is assigned to
        envelopes, and spending comes out of them, so an envelope never runs short: a transaction
        waits until its envelope has enough.
      </p>
      <p>
        Your household’s budget is kept in your account and shared by everyone in the household.
        Install the app on your phone’s home screen to keep it at hand.
      </p>
      <p>
        <a href="https://enoughmoney.app/">enoughmoney.app</a> · Version {APP_VERSION}
      </p>
    </section>
  );
}
