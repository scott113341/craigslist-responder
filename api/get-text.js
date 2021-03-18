import Twilio from "twilio";
import { Client } from "pg";

const { MessagingResponse } = Twilio.twiml;

const { ADDRESS, DATABASE_URL, TWILIO_AUTH_TOKEN, TWILIO_WEBHOOK_URL } = process.env;

const ITEMS = {
  clock: true,
  sword: false,
};

export default async (req, res) => {
  // Verify Twilio sent this request
  const signature = req.headers["x-twilio-signature"];
  const { body } = req;
  const valid = Twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, TWILIO_WEBHOOK_URL, body);
  if (!valid) {
    throw "Failed Twilio signature verification";
  }

  // Generate the response message
  const [item, itemStatus] = getItem(body);
  const message = getResponseMessage(item, itemStatus);
  console.log(body);
  console.log({ item, itemStatus, message });

  // Save the person who texted if they specified a valid item
  if (item) {
    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    await client.query("insert into texters (phone, item, item_status) values($1, $2, $3)", [
      body.From,
      item,
      itemStatus,
    ]);
  }

  // Send the actual response to the webhook
  const twiml = new MessagingResponse();
  twiml.message(message);
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

function getResponseMessage(item, itemStatus) {
  if (itemStatus === true) {
    return `The ${item} is still available! My address is ${ADDRESS}. It's sitting on the front steps. I will not hold the ${item} for any reason. Thanks!`;
  } else if (itemStatus === false) {
    return `Sorry, the ${item} is no longer available`;
  } else {
    return `Sorry, what #item are you interested in from the craigslist post?`;
  }
}
