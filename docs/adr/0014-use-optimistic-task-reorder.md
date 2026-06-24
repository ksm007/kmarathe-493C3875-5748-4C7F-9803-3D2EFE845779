# 0014: Use optimistic task reorder

Task drag-and-drop uses optimistic reorder behavior. The client updates the board immediately, sends the reorder request in the background, avoids a full board reload after successful drags, and rolls back to the previous order if the server rejects the change.
