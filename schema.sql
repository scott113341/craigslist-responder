CREATE TABLE items (
    name text PRIMARY KEY,
    available boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX items_pkey ON items(name text_ops);

CREATE TABLE texters (
    id SERIAL PRIMARY KEY,
    phone text NOT NULL,
    item text NOT NULL REFERENCES items(name),
    item_status boolean NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX texters_pkey ON texters(id int4_ops);
