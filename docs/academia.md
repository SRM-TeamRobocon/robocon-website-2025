# SRM Academia dashboard

`/dashboard/academia` is available to signed-in members, leads and admins. It
connects to the Edutech SRM API using the member's SRM Academia credentials and
loads the API's combined `/api/hydrate` response, which can include attendance,
marks, courses, timetable, calendar and circulars.
The timetable shows entries Edutech marks as the member's own classes. All
sections remain visible when a dataset is empty. Temporary upstream failures
show a retry action without discarding previously loaded records.
When Edutech returns an empty attendance array, the page identifies that as
missing upstream data rather than an unavailable dashboard feature.
The Calendar section uses a month grid for the academic planner. Members can
navigate months, return to today, and select a date to view its day order and
holidays.

The browser sends credentials only to `POST /api/member/academia`. The server
validates them with Edutech's `/api/login`, then discards them. No SRM username,
password, or Edutech access token is stored in the database. An HTTP-only browser
session cookie holds the access token and is scoped to the signed-in member
account. When that cookie or the Edutech token expires, the member signs in to
Academia again. `DELETE` clears the cookie. All handlers require a valid
dashboard session and a member account id.

The upstream base URL is `ACADEMIA_API_URL`, defaulting to the Edutech backend
already used by the day-order sync. The integration depends on Edutech's login,
token and hydrate response formats.
