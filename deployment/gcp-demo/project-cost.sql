-- Replace PROJECT_ID and BILLING_ACCOUNT_ID (hyphens changed to underscores)
-- before running this template. The export contains all projects on the billing account.
-- Authorize only this fixed, no-argument procedure on the restricted export dataset.
CREATE OR REPLACE PROCEDURE `PROJECT_ID.billing_dashboard.project_cost`()
BEGIN
  DECLARE ready BOOL DEFAULT FALSE;
  SET ready = (
    SELECT COUNT(*) > 0
    FROM `PROJECT_ID.billing_export.INFORMATION_SCHEMA.TABLES`
    WHERE table_name = 'gcp_billing_export_v1_BILLING_ACCOUNT_ID'
  );
  IF ready THEN
    EXECUTE IMMEDIATE """
      SELECT currency,
        SUM(cost) AS gross_cost,
        SUM(cost + IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)) AS net_cost,
        MAX(export_time) AS last_export,
        MAX(usage_end_time) AS latest_usage,
        COUNT(*) AS row_count
      FROM `PROJECT_ID.billing_export.gcp_billing_export_v1_BILLING_ACCOUNT_ID`
      WHERE project.id = 'PROJECT_ID'
      GROUP BY currency
    """;
  ELSE
    SELECT 'PENDING' AS currency;
  END IF;
END;
