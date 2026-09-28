import { useState } from 'react'
import { getDistricts, getProvinces, getSectors } from 'rwanda-locations'
import { Field, SearchSelect } from './ui'

function matchLocation(value: string | undefined, options: string[]) {
  if (!value) return ''
  const exact = options.find((item) => item.toLowerCase() === value.toLowerCase())
  if (exact) return exact
  return options.find((item) =>
    item.toLowerCase().includes(value.toLowerCase()) || value.toLowerCase().includes(item.toLowerCase()),
  ) ?? ''
}

export function RwandaAddress({
  defaultProvince = '',
  defaultDistrict = '',
  defaultSector = '',
}: {
  defaultProvince?: string
  defaultDistrict?: string
  defaultSector?: string
}) {
  const provinces = getProvinces()
  const initialProvince = matchLocation(defaultProvince, provinces)
  const initialDistricts = initialProvince ? getDistricts(initialProvince) : []
  const initialDistrict = matchLocation(defaultDistrict, initialDistricts)
  const initialSectors = initialProvince && initialDistrict ? getSectors(initialProvince, initialDistrict) : []

  const [province, setProvince] = useState(initialProvince)
  const [district, setDistrict] = useState(initialDistrict)
  const [sector, setSector] = useState(matchLocation(defaultSector, initialSectors))

  const districts = province ? getDistricts(province) : []
  const sectors = province && district ? getSectors(province, district) : []

  return (
    <div className="app-form rwanda-address">
      <Field label="Province" hint="Official Rwanda administrative province">
        <SearchSelect
          name="province"
          required
          allowEmpty
          value={province}
          placeholder="Search province…"
          options={provinces.map((item) => ({ value: item, label: item }))}
          onChange={(next) => {
            setProvince(next)
            setDistrict('')
            setSector('')
          }}
        />
      </Field>
      <Field label="District" hint={province ? `Districts in ${province}` : 'Select a province first'}>
        <SearchSelect
          name="district"
          required
          allowEmpty
          value={district}
          placeholder={province ? 'Search district…' : 'Choose province first'}
          options={districts.map((item) => ({ value: item, label: item }))}
          onChange={(next) => {
            setDistrict(next)
            setSector('')
          }}
        />
      </Field>
      <Field label="Sector" span="full" hint={district ? `Sectors in ${district}` : 'Select a district first'}>
        <SearchSelect
          name="sector"
          allowEmpty
          value={sector}
          placeholder={district ? 'Search sector…' : 'Choose district first'}
          options={sectors.map((item) => ({ value: item, label: item }))}
          onChange={setSector}
        />
      </Field>
    </div>
  )
}
