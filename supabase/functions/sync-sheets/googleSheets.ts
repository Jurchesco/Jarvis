const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export async function sheetsFetch(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${SHEETS_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export async function getOrCreateWorksheet(
  accessToken: string,
  spreadsheetId: string,
  title: string,
): Promise<number> {
  const metaRes = await sheetsFetch(accessToken, `/${spreadsheetId}?fields=sheets.properties`);
  if (!metaRes.ok) {
    throw new Error(`Sheets metadata: ${metaRes.status} ${await metaRes.text()}`);
  }
  const meta = (await metaRes.json()) as {
    sheets?: Array<{ properties?: { title?: string; sheetId?: number } }>;
  };
  const existing = meta.sheets?.find((s) => s.properties?.title === title);
  if (existing?.properties?.sheetId != null) {
    return existing.properties.sheetId;
  }

  const addRes = await sheetsFetch(accessToken, `/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title } } }],
    }),
  });
  if (!addRes.ok) {
    throw new Error(`addSheet: ${addRes.status} ${await addRes.text()}`);
  }
  const addPayload = (await addRes.json()) as {
    replies?: Array<{ addSheet?: { properties?: { sheetId?: number } } }>;
  };
  const sheetId = addPayload.replies?.[0]?.addSheet?.properties?.sheetId;
  if (sheetId == null) {
    throw new Error("addSheet: brak sheetId w odpowiedzi");
  }
  return sheetId;
}

export async function readWorksheetValues(
  accessToken: string,
  spreadsheetId: string,
  worksheetTitle: string,
): Promise<string[][]> {
  const range = encodeURIComponent(`${worksheetTitle}!A:L`);
  const res = await sheetsFetch(
    accessToken,
    `/${spreadsheetId}/values/${range}?majorDimension=ROWS`,
  );
  if (!res.ok) {
    throw new Error(`values.get: ${res.status} ${await res.text()}`);
  }
  const payload = (await res.json()) as { values?: string[][] };
  return payload.values ?? [];
}

export async function writeHeaderRow(
  accessToken: string,
  spreadsheetId: string,
  worksheetTitle: string,
  headers: string[],
): Promise<void> {
  const range = encodeURIComponent(`${worksheetTitle}!A1`);
  const res = await sheetsFetch(accessToken, `/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({ values: [headers] }),
  });
  if (!res.ok) {
    throw new Error(`header update: ${res.status} ${await res.text()}`);
  }
}

export async function batchUpdateRows(
  accessToken: string,
  spreadsheetId: string,
  worksheetTitle: string,
  updates: Array<{ rowNumber: number; values: (string | number)[] }>,
): Promise<void> {
  const chunkSize = 100;
  for (let offset = 0; offset < updates.length; offset += chunkSize) {
    const chunk = updates.slice(offset, offset + chunkSize);
    const data = chunk.map(({ rowNumber, values }) => ({
      range: `${worksheetTitle}!A${rowNumber}:L${rowNumber}`,
      values: [values.map((v) => (v === "" ? "" : v))],
    }));
    const res = await sheetsFetch(accessToken, `/${spreadsheetId}/values:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data,
      }),
    });
    if (!res.ok) {
      throw new Error(`batchUpdate: ${res.status} ${await res.text()}`);
    }
  }
}

export async function appendRows(
  accessToken: string,
  spreadsheetId: string,
  worksheetTitle: string,
  rows: (string | number)[][],
): Promise<void> {
  if (rows.length === 0) return;
  const range = encodeURIComponent(`${worksheetTitle}!A:L`);
  const res = await sheetsFetch(
    accessToken,
    `/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ values: rows }),
    },
  );
  if (!res.ok) {
    throw new Error(`append: ${res.status} ${await res.text()}`);
  }
}
