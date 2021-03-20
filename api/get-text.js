import Twilio from "twilio";
import { Client } from "pg";

const { MessagingResponse } = Twilio.twiml;

const { ADDRESS, DATABASE_URL, TWILIO_AUTH_TOKEN, TWILIO_WEBHOOK_URL } = process.env;

const ITEMS = {
  clock: false,
  cup: true,
  sword: false,
};

export default async (req, res) => {
  // Verify Twilio sent this request
  const signature = req.headers["x-twilio-signature"];
  const { body } = req;
  console.log(body);
  const valid = Twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, TWILIO_WEBHOOK_URL, body);
  if (!valid) {
    throw "Failed Twilio signature verification";
  }

  // Connect to Postgres
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // Instantiate and set the final "TwiML" (Twilio's XML schema) response
  const twiml = new MessagingResponse();
  const [item, itemStatus] = getItem(body);
  console.log({ item, itemStatus });
  if (item) {
    await client.query("insert into texters (phone, item, item_status) values($1, $2, $3)", [
      body.From,
      item,
      itemStatus,
    ]);
    const otherTexters = await client.query(
      "select count(distinct phone)::int from texters where item = $1 and phone != $2",
      [item, body.From]
    );
    twiml.message(getResponseMessage(item, itemStatus, otherTexters.rows[0].count));
  } else {
    twiml.message("Sorry, what #item are you interested in from the craigslist post?");
  }
  console.log(twiml.toString());

  // Send the webhook response
  res.setHeader("Content-Type", "text/xml");
  res.send(twiml.toString());
};

function getItem(body) {
  try {
    const item = body.Body.match(/#(\w+)/)[1];
    const itemStatus = ITEMS[item];
    if (itemStatus === true || itemStatus === false) {
      return [item, itemStatus];
    } else {
      return [null, null];
    }
  } catch {
    return [null, null];
  }
}

function getResponseMessage(item, itemStatus, otherTexters) {
  if (itemStatus === true) {
    const others =
      {
        0: "No one besides you has",
        1: "1 other person has",
      }[otherTexters] || `${otherTexters} other people have`;

    return [
      `The ${item} is still available!`,
      `My address is ${ADDRESS}.`,
      "It's sitting on the front steps.",
      `${others} texted me so far.`,
      `I will not hold the ${item} for any reason. Thanks!`,
    ].join(" ");
  } else if (itemStatus === false) {
    return `Sorry, the ${item} is no longer available`;
  } else {
    return `Sorry, what #item are you interested in from the craigslist post?`;
  }
}
