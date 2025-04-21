import React from 'react';
import { Button } from 'antd';
import styled from 'styled-components';

const StyledButton = styled(Button)`
  font-size: 17px;
  font-weight: 400;
  display: flex;
  justify-content: left;
`;

interface NavButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}

const NavButton: React.FC<NavButtonProps> = ({ icon, onClick, children }) => {
	return (
		<StyledButton 
			type="text" 
			icon={icon} 
			size="large" 
			block
			onClick={onClick}
		>
			{children}
		</StyledButton>
	);
};

export default NavButton;
