"""
Phase 1 test — OSRM blocked-corridor passthrough guard.

Mocks requests.get to return a fabricated OSRM geometry that passes
directly through the blocked corridor's node coordinates, then asserts
that fetch_osrm_route() discards that geometry (returns None) rather than
handing it to the frontend as a valid diversion.
"""

import json
import types
import unittest
from unittest.mock import MagicMock, patch

from diversion_route_planner import (
    build_graph,
    fetch_osrm_route,
    find_diversion_routes,
)
from graph_config import NODES


def _make_osrm_response(coordinates):
    """Build a minimal OSRM-shaped response dict with the given [lon,lat] coords."""
    return {
        "code": "Ok",
        "routes": [
            {
                "distance": 5000.0,
                "duration": 600.0,
                "geometry": {"coordinates": coordinates},
            }
        ],
    }


class TestOsrmBlockedCorridorGuard(unittest.TestCase):

    def setUp(self):
        self.G = build_graph()
        self.blocked = "Mysore Road"
        # The blocked corridor runs Kengeri → Vijayanagar → CBD.
        # Collect those node coords to use as a "through-blocked" geometry.
        self.kengeri = (NODES["Kengeri"]["lon"], NODES["Kengeri"]["lat"])
        self.vijayanagar = (NODES["Vijayanagar"]["lon"], NODES["Vijayanagar"]["lat"])
        self.cbd = (NODES["CBD"]["lon"], NODES["CBD"]["lat"])

    def test_geometry_through_blocked_returns_none(self):
        """OSRM geometry that passes through blocked corridor must be discarded."""
        # Real OSRM responses contain many intermediate points along the road,
        # not just the major junction nodes.  Add midpoints that fall in the
        # interior of the blocked corridor segments (t ≈ 0.5) to simulate this.
        klon, klat = self.kengeri
        vlon, vlat = self.vijayanagar
        clon, clat = self.cbd
        mid1 = [(klon + vlon) / 2, (klat + vlat) / 2]  # midpoint Kengeri→Vijayanagar
        mid2 = [(vlon + clon) / 2, (vlat + clat) / 2]  # midpoint Vijayanagar→CBD
        bad_geom = [
            list(self.kengeri),
            mid1,
            list(self.vijayanagar),
            mid2,
            list(self.cbd),
        ]
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = _make_osrm_response(bad_geom)

        with patch("diversion_route_planner.requests.get", return_value=mock_resp):
            result = fetch_osrm_route(self.G, ["Kengeri", "Vijayanagar", "CBD"], blocked_corridor=self.blocked)

        self.assertIsNone(
            result,
            "fetch_osrm_route should return None when OSRM geometry crosses blocked corridor",
        )

    def test_clean_geometry_passes_through(self):
        """OSRM geometry that avoids blocked corridor should be returned normally."""
        # Use Jayanagar (off Mysore Road) as an intermediate — clearly not on the blocked corridor.
        jayanagar = (NODES["Jayanagar"]["lon"], NODES["Jayanagar"]["lat"])
        good_geom = [
            list(self.kengeri),
            list(jayanagar),
            list(self.cbd),
        ]
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = _make_osrm_response(good_geom)

        with patch("diversion_route_planner.requests.get", return_value=mock_resp):
            result = fetch_osrm_route(self.G, ["Kengeri", "Jayanagar", "CBD"], blocked_corridor=self.blocked)

        self.assertIsNotNone(result, "Clean geometry should be returned as-is")
        self.assertIn("geometry", result)
        self.assertIn("duration_min", result)

    def test_no_blocked_corridor_passes_through(self):
        """Without a blocked_corridor arg, no check is performed (backward compat)."""
        bad_geom = [list(self.kengeri), list(self.vijayanagar), list(self.cbd)]
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = _make_osrm_response(bad_geom)

        with patch("diversion_route_planner.requests.get", return_value=mock_resp):
            result = fetch_osrm_route(self.G, ["Kengeri", "Vijayanagar", "CBD"])

        self.assertIsNotNone(result, "No blocked_corridor → no check → geometry returned")

    def test_diversion_routes_exclude_blocked(self):
        """End-to-end: find_diversion_routes must not include blocked corridor edges."""
        primary, secondary = find_diversion_routes(
            self.G, self.blocked, "Kengeri", "CBD", hotspots=[]
        )
        for path in [primary, secondary]:
            if not path:
                continue
            for u, v in zip(path, path[1:]):
                edge_data = self.G.get_edge_data(u, v)
                self.assertIsNotNone(edge_data, f"Edge {u}→{v} missing from graph")
                corridors = {d["corridor"] for d in edge_data.values()}
                self.assertNotIn(
                    self.blocked,
                    corridors,
                    f"Diversion path uses blocked corridor on edge {u}→{v}",
                )


if __name__ == "__main__":
    unittest.main(verbosity=2)
