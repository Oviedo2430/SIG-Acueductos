import wntr
from shapely.geometry import Point, LineString

print('WNTR version:', wntr.__version__)
wn = wntr.network.WaterNetworkModel()
wn.add_junction('J1', base_demand=0.1, elevation=10, coordinates=(100, 200))
wn.add_pipe('P1', 'J1', 'J1', length=10, diameter=0.1, roughness=100)

for name, node in wn.junctions():
    print('Junction:', name, node.coordinates, hasattr(node, 'base_demand'), getattr(node, 'base_demand', None))

for name, pipe in wn.pipes():
    print('Pipe:', name, pipe.start_node_name, pipe.end_node_name, pipe.diameter, pipe.roughness)
