## Coqui Encuestas

Live classroom quiz app with separate teacher and student routes.

### Routes

- `/` landing page with links into each mode
- `/teacher` quiz authoring and room control
- `/join` student room join and voting

### Behavior

- Teachers can create questions, publish a room, move between questions, and close the session.
- Students join with a room code, vote on the active question, and see live result bars.
- Answers sync through server-side API routes backed by DynamoDB.
- Live updates are delivered by client polling (every ~1.5s), which is deployment-safe for serverless environments.

### Run

```bash
npm run dev
```

### Build

```bash
npm run build
```

## AWS Deployment Plan

### 1. Target Platform

- Deploy the Next.js app to AWS Amplify Hosting (SSR enabled).
- Use AWS DynamoDB as the shared room state store.
- Use IAM roles for Amplify runtime access to DynamoDB.

### 2. DynamoDB Setup

- Create a table for rooms with:
  - Partition key: `roomCode` (String)
  - TTL attribute: `ttl` (Number)
- Room records store:
  - `roomCode`
  - `room` (full quiz room object)
  - `version` (optimistic concurrency)
  - `ttl` (auto-expiry, 24h)

### 3. App Configuration

Set these environment variables in Amplify:

- `AWS_REGION`
- `DYNAMODB_TABLE_NAME`

For local development, set the same values in your local environment and authenticate with AWS credentials (profile, SSO, or access keys).

### 4. IAM Permissions

Grant Amplify runtime role least-privilege access to the rooms table:

- `dynamodb:GetItem`
- `dynamodb:PutItem`

Because room updates use conditional writes, `PutItem` must be allowed with condition expressions.

### 5. Deployment Steps

1. Push this repository to GitHub.
2. Connect the repo in AWS Amplify.
3. Confirm Amplify uses `amplify.yml` from the repo.
4. Add env vars (`AWS_REGION`, `DYNAMODB_TABLE_NAME`).
5. Attach IAM permissions for the DynamoDB table to the Amplify role.
6. Deploy and run smoke tests:
   - Create room on `/teacher`
   - Join from `/join` on a second device
   - Verify votes and question changes propagate within ~1.5 seconds

### 6. Operational Notes

- This architecture supports many devices and many app instances because state is centralized in DynamoDB.
- Polling avoids long-lived connection issues common in serverless platforms.
- Data survives app restarts and rolling deployments.
