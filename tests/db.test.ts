import { describe, expect, it } from "vitest";
import { castJsonParamsViaText } from "../lib/db";

describe("castJsonParamsViaText", () => {
  it("routes json/jsonb parameter casts through text", () => {
    expect(castJsonParamsViaText("select * from json_populate_recordset(null::items, $1::json)")).toBe(
      "select * from json_populate_recordset(null::items, $1::text::json)",
    );
    expect(castJsonParamsViaText("values ($1,$12::jsonb,$3)")).toBe("values ($1,$12::text::jsonb,$3)");
  });

  it("leaves column casts and literals alone", () => {
    const sql = "select '{}'::jsonb, data::json, count(*)::int from t where id = $1";
    expect(castJsonParamsViaText(sql)).toBe(sql);
  });
});
