"""Tests for Google Calendar event color threading."""

from unittest.mock import MagicMock, patch

from src.calendar_sync import create_or_update_event, sync_calendar, sync_from_cache


def _mock_service(existing_event=None):
    """Build a mock Google Calendar service."""
    service = MagicMock()
    # events().list() for find_event_by_date_and_title
    list_execute = MagicMock(return_value={'items': [existing_event] if existing_event else []})
    service.events.return_value.list.return_value.execute = list_execute
    # events().insert()
    insert_execute = MagicMock(return_value={'id': 'new-1', 'htmlLink': 'http://cal/new-1'})
    service.events.return_value.insert.return_value.execute = insert_execute
    # events().update()
    update_execute = MagicMock(return_value={'id': 'upd-1', 'htmlLink': 'http://cal/upd-1'})
    service.events.return_value.update.return_value.execute = update_execute
    return service


class TestEventBodyColor:
    def test_event_body_includes_color_id(self):
        service = _mock_service()
        create_or_update_event(
            service, '2026-03-01', 'Turtle', 'Delicious',
            color_id='9',
        )
        body = service.events.return_value.insert.call_args[1]['body']
        assert body['colorId'] == '9'

    def test_event_body_omits_color_when_empty(self):
        service = _mock_service()
        create_or_update_event(
            service, '2026-03-01', 'Turtle', 'Delicious',
        )
        body = service.events.return_value.insert.call_args[1]['body']
        assert 'colorId' not in body

    def test_event_body_omits_color_when_not_provided(self):
        service = _mock_service()
        create_or_update_event(
            service, '2026-03-01', 'Turtle', 'Delicious',
            color_id='',
        )
        body = service.events.return_value.insert.call_args[1]['body']
        assert 'colorId' not in body


class TestSyncCalendarThreadsColor:
    def test_sync_calendar_passes_color_to_events(self):
        service = _mock_service()
        flavors = [
            {'date': '2026-03-01', 'name': 'Turtle', 'description': 'Good'},
        ]
        sync_calendar(service, flavors, color_id='9')
        body = service.events.return_value.insert.call_args[1]['body']
        assert body['colorId'] == '9'

    def test_sync_calendar_no_color_by_default(self):
        service = _mock_service()
        flavors = [
            {'date': '2026-03-01', 'name': 'Turtle', 'description': 'Good'},
        ]
        sync_calendar(service, flavors)
        body = service.events.return_value.insert.call_args[1]['body']
        assert 'colorId' not in body

    def test_sync_calendar_per_flavor_checks_existing_event_once(self):
        service = _mock_service()
        flavors = [
            {'date': '2026-03-01', 'name': 'Turtle', 'description': 'Good'},
        ]

        sync_calendar(service, flavors)

        # Regression guard: avoid duplicate list() calls per flavor.
        assert service.events.return_value.list.call_count == 1


class TestSyncFromCacheThreadsColor:
    @patch('src.calendar_sync.sync_calendar')
    @patch('src.calendar_sync.authenticate')
    def test_sync_from_cache_passes_color_id(self, mock_auth, mock_sync):
        mock_sync.return_value = {'created': 1, 'updated': 0, 'errors': 0}
        service = MagicMock()
        cache_data = {
            'locations': {
                'mt-horeb': {
                    'name': 'Mt. Horeb',
                    'role': 'primary',
                    'flavors': [{'date': '2026-03-01', 'name': 'Turtle', 'description': ''}],
                },
            },
        }
        sync_from_cache(service, cache_data, 'cal-id', color_id='9')
        _, kwargs = mock_sync.call_args
        assert kwargs['color_id'] == '9'
