# 0003: Users can belong to multiple organizations

The SaaS model separates identity from tenant access: `User` represents the human who signs in, `Organization` represents the tenant workspace, and `Membership` connects a user to an organization with a role. This supports Google sign-in and invite links without duplicating users or blocking the same email from joining more than one organization.
