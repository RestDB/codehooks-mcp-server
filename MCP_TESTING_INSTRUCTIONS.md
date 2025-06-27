# Codehooks MCP Server - LLM Testing Instructions

## Overview

This document provides step-by-step instructions for an LLM to systematically test all 21 Codehooks MCP tools. Follow these phases sequentially to ensure comprehensive testing.

## Prerequisites

- Codehooks MCP server must be running and connected
- Use `mcp_codehooks_*` tool names (they all start with this prefix)
- Test in a clean environment or use test collections to avoid affecting production data

## Testing Methodology

### Phase 1: Documentation & Information Tools

**Purpose**: Verify basic connectivity and information retrieval

1. **Test `docs` tool**:

   ```
   mcp_codehooks_docs(topic="overview")
   mcp_codehooks_docs(topic="chatgpt-prompt")
   mcp_codehooks_docs(topic="workflow-api")
   mcp_codehooks_docs(topic="examples")
   ```

2. **Test `collection` tool**:

   ```
   mcp_codehooks_collection(json=true)
   mcp_codehooks_collection(sys=true)
   ```

3. **Test `logs` tool**:
   ```
   mcp_codehooks_logs(tail=10)
   ```

**Expected Results**: All tools return proper documentation, collection lists, and recent logs.

---

### Phase 2: Collection Management

**Purpose**: Test collection lifecycle operations

1. **Create test collection**:

   ```
   mcp_codehooks_create_collection(collection="test_systematic")
   ```

2. **Add index**:

   ```
   mcp_codehooks_create_index(collection="test_systematic", index="name")
   ```

3. **Verify collection exists**:
   ```
   mcp_codehooks_collection(json=true)
   ```

**Expected Results**: Collection created successfully, index added, appears in collection list.

---

### Phase 3: Data Operations

**Purpose**: Test data import, querying, and export

1. **Import test data**:

   ```
   mcp_codehooks_import(
     collection="test_systematic",
     content='[{"name":"Alice","role":"Developer","level":5},{"name":"Bob","role":"Designer","level":3},{"name":"Charlie","role":"Manager","level":7}]'
   )
   ```

2. **Query data**:

   ```
   mcp_codehooks_query_collection(collection="test_systematic")
   mcp_codehooks_query_collection(collection="test_systematic", query='{"level":{"$gte":5}}')
   mcp_codehooks_query_collection(collection="test_systematic", limit=2)
   mcp_codehooks_query_collection(collection="test_systematic", sort="level", reverse=true)
   ```

3. **Count records**:

   ```
   mcp_codehooks_query_collection(collection="test_systematic", count=true)
   ```

4. **Export data**:
   ```
   mcp_codehooks_export(collection="test_systematic")
   mcp_codehooks_export(collection="test_systematic", csv=true)
   mcp_codehooks_export(collection="test_systematic", jsonl=true)
   ```

**Expected Results**: Data imported, queries return filtered results, exports work in all formats.

---

### Phase 4: Key-Value Store Operations

**Purpose**: Test KV store functionality

1. **Set key-value pairs**:

   ```
   mcp_codehooks_kv_set(key="test_string", val="Hello World")
   mcp_codehooks_kv_set(key="test_json", val='{"name":"test","value":123}')
   mcp_codehooks_kv_set(key="test_ttl", val="expires_soon", ttl=60000)
   ```

2. **Get values**:

   ```
   mcp_codehooks_kv_get(key="test_string")
   mcp_codehooks_kv_get(key="test_json")
   mcp_codehooks_kv_get(key="test*")
   ```

3. **Delete keys**:
   ```
   mcp_codehooks_kv_del(key="test_ttl")
   ```

**Expected Results**: Values stored and retrieved correctly, pattern matching works, TTL set properly.

---

### Phase 5: File Operations

**Purpose**: Test file upload, listing, and deletion

1. **Upload test file**:

   ```
   mcp_codehooks_file_upload(
     target="test_file.txt",
     content="This is a test file for MCP testing."
   )
   ```

2. **List files**:

   ```
   mcp_codehooks_file_list()
   ```

3. **Test delete with dryrun**:

   ```
   mcp_codehooks_file_delete(filename="test_file.txt", dryrun=true)
   ```

4. **Actually delete file**:
   ```
   mcp_codehooks_file_delete(filename="test_file.txt")
   ```

**Expected Results**: File uploaded, appears in listing, dryrun shows what would be deleted, actual deletion removes file.

---

### Phase 6: Schema Management & Collection Features

**Purpose**: Test schema validation and collection capping

1. **Add JSON schema**:

   ```
   mcp_codehooks_add_schema(
     collection="test_systematic",
     schema='{"type":"object","properties":{"name":{"type":"string","minLength":2},"role":{"type":"string"},"level":{"type":"number","minimum":1,"maximum":10}},"required":["name","role","level"]}'
   )
   ```

2. **Verify schema blocks invalid data** (should fail):

   ```
   mcp_codehooks_import(
     collection="test_systematic",
     content='[{"name":"X","role":"Invalid","level":15}]'
   )
   ```

3. **Cap collection**:

   ```
   mcp_codehooks_cap_collection(collection="test_systematic", cap=5)
   ```

4. **Verify collection info**:
   ```
   mcp_codehooks_collection(json=true)
   ```

**Expected Results**: Schema added, invalid data rejected, collection capped at 5 documents.

---

### Phase 7: Update Operations & Advanced Querying

**Purpose**: Test update functionality and complex queries

⚠️ **CRITICAL**: Remove schema first, as it blocks updates:

```
mcp_codehooks_remove_schema(collection="test_systematic")
```

1. **Test direct updates**:

   ```
   mcp_codehooks_query_collection(
     collection="test_systematic",
     query='{"name":"Alice"}',
     update='{"level":6}'
   )
   ```

2. **Test $set syntax updates**:

   ```
   mcp_codehooks_query_collection(
     collection="test_systematic",
     query='{"name":"Bob"}',
     update='{"$set":{"level":8,"department":"Design"}}'
   )
   ```

3. **Verify updates worked**:
   ```
   mcp_codehooks_query_collection(collection="test_systematic")
   ```

**Expected Results**: Both update syntaxes work, fields updated correctly.

---

### Phase 8: Code Deployment

**Purpose**: Test application deployment

1. **Deploy test application**:

   ```
   mcp_codehooks_deploy_code(
     files=[{
       "path": "index.js",
       "content": "import { app } from 'codehooks-js';\n\napp.get('/test-deployment', (req, res) => {\n  res.json({ message: 'Test successful!', timestamp: new Date().toISOString() });\n});\n\napp.crudlify();\n\nexport default app.init();"
     }]
   )
   ```

2. **Verify deployment**:
   ```
   mcp_codehooks_query_collection(collection="_hooks", limit=1, reverse=true, sort="_id")
   ```

**Expected Results**: Code deployed successfully, new endpoint appears in hooks metadata.

---

### Phase 9: Cleanup & Additional Tests

**Purpose**: Test remaining tools and cleanup

1. **Test remaining tools**:

   ```
   mcp_codehooks_drop_index(collection="test_systematic", index="name")
   mcp_codehooks_uncap_collection(collection="test_systematic")
   ```

2. **Cleanup test data**:

   ```
   mcp_codehooks_query_collection(collection="test_systematic", delete=true)
   mcp_codehooks_drop_collection(collection="test_systematic")
   ```

3. **Clean up KV store**:
   ```
   mcp_codehooks_kv_del(key="test_string")
   mcp_codehooks_kv_del(key="test_json")
   ```

**Expected Results**: All cleanup operations succeed, test data removed.

---

## Common Issues & Solutions

### Update Operations Fail

- **Cause**: JSON schema validation blocking updates
- **Solution**: Remove schema with `mcp_codehooks_remove_schema()` before testing updates

### Schema Validation Errors

- **Expected**: Schema should reject data that doesn't match validation rules
- **Test**: Try inserting invalid data to confirm validation works

### File Operations

- **Note**: Use `dryrun=true` first to see what would be deleted
- **Path**: Files are uploaded to project file storage, not local filesystem

### Logs and API Calls

- **Remember**: Logs only show actual API calls to deployed endpoints
- **MCP tools**: Direct database operations don't appear in logs

## Success Criteria

✅ **All 21 tools execute without errors**
✅ **Data operations work correctly** (CRUD, import/export)
✅ **Schema validation functions properly**
✅ **File operations complete successfully**
✅ **KV store operations work with TTL**
✅ **Code deployment succeeds**
✅ **Update operations work with both syntaxes**
✅ **Advanced queries with MongoDB operators function**
✅ **Collection management tools work**
✅ **Documentation tools return proper content**

## Tool Count Verification

Ensure you've tested all 21 tools:

1. query_collection
2. deploy_code
3. file_upload
4. file_delete
5. file_list
6. create_index
7. drop_index
8. create_collection
9. drop_collection
10. add_schema
11. remove_schema
12. cap_collection
13. uncap_collection
14. import
15. export
16. kv_get
17. kv_set
18. kv_del
19. logs
20. docs
21. collection

## Final Notes

- Execute phases sequentially - later phases depend on earlier setup
- Pay attention to error messages - they often indicate expected behavior
- Schema validation is a feature, not a bug - test both valid and invalid data
- Always clean up test data when finished
- If any tool fails unexpectedly, check recent logs for error details
