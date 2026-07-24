import { RQL, RentManagerClient } from "../src/index.js";

const client = new RentManagerClient({
  corpId: process.env.RM_CORP_ID ?? "",
  username: process.env.RM_USERNAME ?? "",
  password: process.env.RM_PASSWORD ?? "",
  locationId: process.env.RM_LOCATION_ID
    ? Number(process.env.RM_LOCATION_ID)
    : null,
});

try {
  const tenants = await client.tenants.list({
    fields: ["TenantID", "Name"],
    filters: [RQL.eq("IsActive", true)],
    pageSize: 100,
  });
  for (const tenant of tenants) {
    console.log(tenant.TenantID, tenant.Name);
  }
} finally {
  await client.close();
}
