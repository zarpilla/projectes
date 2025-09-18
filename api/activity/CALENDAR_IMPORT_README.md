# Calendar Import API Improvements

## Overview
The `importCalendar` endpoint has been enhanced to support recurring events and date filtering for better performance and functionality.

## New Features

### 1. Recurring Events Support
- **Problem Solved**: Previously, weekly, monthly, and other recurring events were not visible in calendar imports
- **Solution**: Integrated `rrule` library to parse and expand RRULE patterns from iCal files
- **Supported Recurrence Types**: 
  - Daily recurrence
  - Weekly recurrence
  - Monthly recurrence
  - Yearly recurrence
  - Custom intervals and complex patterns

### 2. Date Range Filtering
- **Problem Solved**: Performance issues when loading entire calendar history
- **Solution**: Added `from` and `to` query parameters for date filtering
- **Format**: YYYY-MM-DD
- **Default Behavior**: If no dates provided, returns current month's events

## API Usage

### Endpoint
```
GET /activities/import-calendar/{userId}?from=YYYY-MM-DD&to=YYYY-MM-DD
```

### Parameters
- `userId` (path): User ID whose calendar to import
- `from` (query, optional): Start date in YYYY-MM-DD format
- `to` (query, optional): End date in YYYY-MM-DD format

### Examples

#### Get current month's events (default behavior)
```
GET /activities/import-calendar/123
```

#### Get events for a specific date range
```
GET /activities/import-calendar/123?from=2024-01-01&to=2024-01-31
```

#### Get events for a specific week
```
GET /activities/import-calendar/123?from=2024-01-15&to=2024-01-21
```

## Response Format

```json
{
  "ical": [
    {
      "uid": "event-uid",
      "summary": "Event Title",
      "start": "2024-01-15T09:00:00.000Z",
      "end": "2024-01-15T10:00:00.000Z",
      "description": "Event description",
      "isRecurring": true,
      "recurringDate": "2024-01-15",
      // ... other iCal properties
    }
  ],
  "dateRange": {
    "from": "2024-01-01",
    "to": "2024-01-31"
  },
  "totalEvents": 25
}
```

## New Properties in Response

### For Recurring Events
- `isRecurring`: Boolean flag indicating if this is an instance of a recurring event
- `recurringDate`: The specific date of this occurrence in YYYY-MM-DD format

### Metadata
- `dateRange`: Shows the actual date range used for filtering
- `totalEvents`: Total number of events returned (including recurring instances)

## Error Handling

### Invalid Date Format
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Invalid from date format. Use YYYY-MM-DD"
}
```

### Calendar Access Issues
- Errors fetching calendars are logged but don't stop the process
- Partial results are returned if one calendar fails

## Performance Improvements

1. **Date Filtering**: Only processes events within the specified date range
2. **Efficient Recurrence Expansion**: Uses the `rrule` library's optimized algorithms
3. **Error Handling**: Continues processing even if individual calendars fail
4. **Sorting**: Events are sorted by start date for consistent ordering

## Technical Details

### Dependencies Added
- `rrule`: For parsing and expanding RFC 5545 RRULE patterns

### Recurring Event Processing
1. Checks if event has an RRULE property
2. Parses the RRULE using the rrule library
3. Generates occurrences within the specified date range
4. Creates individual event instances for each occurrence
5. Preserves original event properties while updating dates

### Calendar Sources
The endpoint processes two calendar sources:
1. **User's Personal Calendar**: From user.ical URL
2. **Shared Calendar**: From me.ical URL (only events where user is an attendee)

## Migration Notes
- **Backward Compatible**: Existing API calls without date parameters continue to work
- **New Response Format**: Additional metadata fields added, but existing `ical` array structure preserved
- **No Breaking Changes**: All existing event properties are maintained
