# 0004: Use explicit active organization context

Authentication returns the signed-in user and their memberships. If the user has one membership, the client can select it automatically; if the user has multiple memberships, the client shows an organization switcher. API access tokens include the selected organization so every tenant-scoped request has explicit organization context.
