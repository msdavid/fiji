// frontend/tests/__mocks__/next_link.js
import React from 'react';

// A basic mock for next/link that renders an <a> tag
// and passes through props like href, children, className.
// It doesn't attempt to replicate Next.js routing behavior,
// as that's usually not the focus of component unit tests.
const NextLinkMock = ({ children, href, ...props }) => {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
};

export default NextLinkMock;