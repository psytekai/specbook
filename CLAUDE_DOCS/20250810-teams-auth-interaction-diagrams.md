# Teams Integration Authentication Interaction Diagrams

## 1. Primary Flow: Teams SSO Authentication

```mermaid
sequenceDiagram
    participant User
    participant Teams as Microsoft Teams
    participant Tab as Retain Tab App
    participant API as Retain Backend
    participant Graph as Microsoft Graph
    participant DB as Retain Database

    User->>Teams: Opens Retain Tab
    Teams->>Tab: Load tab with Teams context
    Tab->>Tab: Initialize Teams SDK
    Tab->>Teams: Request auth token
    Teams->>User: Silent authentication (cached)
    Teams-->>Tab: Teams token
    Tab->>API: POST /api/teams/auth<br/>{teams_token, context}
    API->>Graph: Validate token
    Graph-->>API: User identity + claims
    API->>DB: Find/Create user mapping
    DB-->>API: Retain user session
    API-->>Tab: Session token + employer data
    Tab->>User: Display personalized content
```

## 2. Fallback: Manual Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Teams as Microsoft Teams
    participant Tab as Retain Tab App
    participant API as Retain Backend
    participant Auth as Retain Auth Service

    User->>Teams: Opens Retain Tab
    Teams->>Tab: Load tab (SSO fails)
    Tab->>Tab: Detect SSO failure
    Tab->>User: Show login prompt
    User->>Tab: Click "Sign In"
    Tab->>Teams: Open auth popup
    Teams->>Auth: Redirect to Retain login
    User->>Auth: Enter credentials
    Auth->>Auth: Validate credentials
    Auth-->>Teams: Return with auth code
    Teams-->>Tab: Auth code
    Tab->>API: POST /api/teams/manual-auth<br/>{auth_code, teams_context}
    API->>API: Validate & create session
    API-->>Tab: Session token + employer data
    Tab->>User: Display personalized content
```

## 3. Token Refresh Flow

```mermaid
sequenceDiagram
    participant Tab as Retain Tab App
    participant API as Retain Backend
    participant Teams as Microsoft Teams
    participant Graph as Microsoft Graph

    Tab->>API: API request with expired token
    API-->>Tab: 401 Token Expired
    Tab->>Tab: Detect token expiration
    Tab->>Teams: Request fresh token<br/>(silent)
    Teams-->>Tab: New Teams token
    Tab->>API: POST /api/teams/refresh<br/>{new_token}
    API->>Graph: Validate new token
    Graph-->>API: Valid token claims
    API->>API: Update session
    API-->>Tab: New session token
    Tab->>Tab: Retry original request
    Tab->>API: Original API request<br/>(with new token)
    API-->>Tab: Requested data
```

## 4. Multi-Tenant Context Flow

```mermaid
sequenceDiagram
    participant User
    participant Teams as Teams (Org A)
    participant Tab as Retain Tab
    participant API as Retain Backend
    participant TenantService as Tenant Service

    User->>Teams: Opens tab in Org A channel
    Teams->>Tab: Load with tenant context
    Tab->>API: Authenticate with context<br/>{token, tenant_id, channel_id}
    API->>TenantService: Resolve tenant config
    TenantService-->>API: Org A settings & permissions
    API->>API: Filter content for Org A
    API-->>Tab: Org A specific data
    Tab->>User: Display Org A content

    Note over User, Tab: User switches to Org B

    User->>Teams: Opens tab in Org B
    Teams->>Tab: New tenant context
    Tab->>API: Re-authenticate<br/>{token, new_tenant_id}
    API->>TenantService: Resolve new tenant
    TenantService-->>API: Org B settings
    API-->>Tab: Org B specific data
    Tab->>User: Display Org B content
```

## 5. Anonymous Analytics Preservation

```mermaid
sequenceDiagram
    participant User
    participant Tab as Retain Tab
    participant API as Retain Backend
    participant Analytics as Analytics Service
    participant HR as HR Dashboard

    User->>Tab: Search "mental health"
    Tab->>API: Search request<br/>{query, session_token}
    API->>API: Process search
    API-->>Tab: Search results
    
    Note over API, Analytics: Parallel anonymous tracking
    
    API->>Analytics: Track event<br/>{action: "search",<br/>category: "mental_health",<br/>employer_id: "123",<br/>anonymous_id: "hash"}
    
    Tab->>User: Display results
    User->>Tab: Click resource
    Tab->>API: Track engagement
    API->>Analytics: Track event<br/>{action: "click",<br/>resource_type: "benefit",<br/>anonymous_id: "hash"}
    
    HR->>Analytics: Request metrics
    Analytics->>Analytics: Aggregate by employer
    Analytics-->>HR: Anonymized usage stats<br/>(no individual identification)
```

## Key Design Principles

1. **Zero-friction primary path**: SSO should work silently for most users
2. **Graceful degradation**: Manual auth available when SSO fails
3. **Transparent refresh**: Users never see token expiration
4. **Strict tenant isolation**: Each organization's data stays separate
5. **Privacy by design**: Analytics never link to individual identity

## Error Handling Points

- **SSO Failure**: Automatic fallback to manual flow
- **Token Expiration**: Silent refresh without user intervention
- **Network Issues**: Retry with exponential backoff
- **Tenant Mismatch**: Re-authenticate with correct context
- **Graph API Errors**: Cache validation results, proceed with limited features