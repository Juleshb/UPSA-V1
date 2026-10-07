export function DeviceFrame() {
  return (
    <div className="device-frame" aria-hidden="true">
      <div className="device-notch" />
      <div className="device-screen">
        <div className="device-top">
          <img src="/rupsa-next-icon.svg" alt="" />
          <span className="brand-lockup product-lockup">
            <b>UPSA</b>
            <i className="brand-rule" />
            <small>Next Payment</small>
          </span>
        </div>
        <div className="device-receipt">
          <em>Paid</em>
          <b>RWF 185,000</b>
          <p>Term 1 school fees · Instant receipt</p>
        </div>
        <ul>
          <li><span>Invoice</span><b>GH-24018</b></li>
          <li><span>Rail</span><b>eKash</b></li>
          <li><span>School</span><b>Settled</b></li>
        </ul>
      </div>
    </div>
  )
}
