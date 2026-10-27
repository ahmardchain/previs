# Previs: a prediction copilot that remembers you — and can prove what it said

*Draft for the Total Recall hackathon (Tatum × Walrus). Edit freely before publishing.*

## The problem

Prediction apps have two memory problems.

1. **They forget you.** Every session starts from zero. The app doesn't know you have a 3% limit, that you always back your own team, or that you've lost your last three football picks.
2. **Nobody's track record is real.** Tipsters delete bad calls and screenshot good ones. There's no easy way to know who was actually right *before* the result.

## What Previs does

Previs is a paper-trading prediction market for sports and crypto with a beginner-friendly copilot. Pick a market, ask a question, and you get one clear pick, a short "why", and how much to put in.

Two things make it different:

- **It learns you.** Your limits, your teams, your picks and their results are stored as Walrus memories. Before every answer, the copilot recalls them, and you can see the effect in a "Because I remember…" box: *"You've lost your last 2 picks — I kept this small so you don't chase losses."*
- **Every pick has a receipt.** When you save a pick, Previs writes it to Walrus Memory and stamps it with the current Sui checkpoint, read through Tatum's Sui RPC, along with a fingerprint of the exact text. Callers are ranked only on receipts saved before the result.

## How it uses Walrus Memory

- One namespace per user holds habits, limits, teams, picks and results.
- A shared credibility namespace holds every caller's graded calls ("lagos-quant called YES and was right — now 12 of 19").
- When a market settles, Previs writes new memories for every player and caller. Those memories change the next answer: sizing, warnings, and whose opinion the copilot trusts.

## How it uses Tatum

- `sui_getLatestCheckpointSequenceNumber` timestamps every receipt on Sui Mainnet.
- `suix_getBalance` and `suix_queryTransactionBlocks` read a connected wallet so the copilot knows whether to explain things simply.

## How it learned over time

*(Fill in from your demo run — e.g. "After two losing football picks the suggested amount dropped from $25 to $10, and the copilot started citing my last result." Add a screenshot of the Portfolio memory list and the Walrus blob IDs.)*

## What's next

Live odds feeds, on-chain settlement, and letting users unlock a top caller's pick with x402 micro-payments on Sui.

Try it: [link to demo] · Code: [link to repo]
