// ==========================
// file: redis-scripts.ts
// ==========================
import Redis from 'ioredis';

export const registerRedisScripts = (redis: Redis) => {
  // Lua script: find nearby drivers and filter by status/vehicle/lock/server-side
  // ARGV: lon, lat, radiusKm, maxCandidatesToReturn, desiredCount, vehicleTypeOrEmpty, geoKey, statusPrefix, driverHashPrefix, lockPrefix
  // Returns array of driver entries as flat arrays: id, dist, lon, lat, vehicleType (or "")
  const findNearbyLua = `
    local lon = ARGV[1]
    local lat = ARGV[2]
    local radius = ARGV[3]
    local maxCandidates = tonumber(ARGV[4])
    local desiredCount = tonumber(ARGV[5])
    local vehicleTypeFilter = ARGV[6]
    local geoKey = ARGV[7]
    local statusPrefix = ARGV[8]
    local driverHashPrefix = ARGV[9]
    local lockPrefix = ARGV[10]

    local raw = redis.call('GEOSEARCH', geoKey, 'FROMLONLAT', lon, lat, 'BYRADIUS', radius, 'km', 'WITHDIST', 'WITHCOORD', 'COUNT', maxCandidates, 'ASC')
    if not raw or #raw == 0 then
      return {}
    end

    local out = {}
    local found = 0

    for i=1,#raw do
      if found >= desiredCount then break end
      local entry = raw[i]
      local id = tostring(entry[1])
      local dist = tostring(entry[2])
      local coord = entry[3]
      local lonVal = tostring(coord[1])
      local latVal = tostring(coord[2])

      local status = redis.call('GET', statusPrefix .. id)
      if status == 'ONLINE' then
        local vehicle = redis.call('HGET', driverHashPrefix .. id, 'vehicleType')
        if (vehicleTypeFilter == '' ) or (vehicle and vehicle == vehicleTypeFilter) then
          local lockExists = redis.call('EXISTS', lockPrefix .. id)
          if lockExists == 0 then
            table.insert(out, id)
            table.insert(out, dist)
            table.insert(out, lonVal)
            table.insert(out, latVal)
            table.insert(out, vehicle and vehicle or '')
            found = found + 1
          end
        end
      end
    end

    return out
  `;

  // Lua script: try acquire lock atomically (set lock and trip mapping only if lock not exists)
  // KEYS: lockKey, tripByDriverKey
  // ARGV: tripId, lockTtlSeconds, tripByDriverTtlSeconds
  const acquireLockLua = `
    if redis.call('EXISTS', KEYS[1]) == 1 then
      return 0
    end
    redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
    redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[3])
    return 1
  `;

  redis.defineCommand('findNearbyDrivers', {
    numberOfKeys: 0,
    lua: findNearbyLua,
  } as any);

  redis.defineCommand('acquireDriverLock', {
    numberOfKeys: 2,
    lua: acquireLockLua,
  } as any);
};
