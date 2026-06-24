# 0012: Password reset tokens are single-use

Password reset links use single-use tokens that expire after 30 minutes. The backend stores only a protected token representation, consumes the token immediately after password change, and invalidates any other active reset tokens for the same user.
