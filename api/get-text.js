import Twilio from "twilio";
import { Client } from "pg";

const { MessagingResponse } = Twilio.twiml;

const { ADDRESS, DATABASE_URL, TWILIO_AUTH_TOKEN, TWILIO_WEBHOOK_URL } = process.env;

export default async (req, res) => {
  const { body } = req;
  console.log(body);

  // Verify Twilio sent this request
  if (!isTwilioRequest(req)) {
    throw "Failed Twilio signature verification";
  }

  // Connect to Postgres and fetch items
  const client = await getPgClient();
  const items = await getItems(client);

  // Instantiate and set the final "TwiML" (Twilio's XML schema) response
  const twiml = new MessagingResponse();
  const [item, itemStatus] = getItem(items, body);
  console.log({ items, item, itemStatus });
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

function isTwilioRequest(req) {
  const signature = req.headers["x-twilio-signature"];
  return Twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, TWILIO_WEBHOOK_URL, req.body);
}

async function getPgClient() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

async function getItems(client) {
  const items = {};
  const itemsRes = await client.query("select * from items");
  itemsRes.rows.forEach((r) => (items[r["name"]] = r["available"]));
  return items;
}

function getItem(items, body) {
  try {
    const item = body.Body.match(/#(\w+)/)[1];
    const itemStatus = items[item];
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
